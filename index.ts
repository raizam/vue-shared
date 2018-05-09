import Vue, { VueConstructor } from 'vue';

export interface CallContext {
    readonly instance: object;
    readonly fnName: string;
    readonly args: any[];
    readonly vue: Vue;
}

interface FnKeyed {
    [id: string]: Function;
}

interface Metadata {
    getters: FnKeyed;
    functions: FnKeyed;
    variables: string[];
}

interface Prop {
    name: string,
    property: PropertyDescriptor
}

function getMetadata(target: any): Metadata {
    const proto = Object.getPrototypeOf(target);
    let propnames = Object.getOwnPropertyNames(proto);
    let protoProperties = propnames.map(n => <Prop>{ name: n, property: Object.getOwnPropertyDescriptor(proto, n) });
    propnames = Object.getOwnPropertyNames(target);
    let properties = propnames.map(n => <Prop>{ name: n, property: Object.getOwnPropertyDescriptor(target, n) }).concat(protoProperties);

    let getterProp = properties.filter(v => v.property.get && !v.property.set);
    let functions = properties.filter(p => !p.property.get && !p.property.set && typeof p.property.value === 'function' && p.name !== 'constructor');
    let variable =  properties.filter(p => typeof p.property.value !== 'undefined' && typeof p.property.value !== 'function');


    let getterObj = {};
    let fnObj = {};

    getterProp.forEach(v => {
        let propName = (<any>v.property.get!).name.split(' ')[1];
        getterObj[propName] = function () { return (<Function>v.property.get).call(target); };
    });

    functions.forEach(e => {
        fnObj[e.name] = <Function>e.property.value;
    });

    return { functions: fnObj, getters: getterObj, variables: variable.map(v => v.name) };
}

const callContextStack: CallContext[] = [];

function currentContext() {
    let l = callContextStack.length;
    if (l === 0)
        return;
    return callContextStack[l - 1];
}

function withinContext(callContext: CallContext, action: () => void) {
    if (callContext) {
        try {
            callContextStack.push(callContext);
            action();
        } finally {

            callContext.vue.$nextTick(() => {
                callContextStack.pop();
            });
        }


    } else action();
}

function install(vue: VueConstructor, options?: any) {

    vue.mixin({

        beforeCreate: function () {

            let shared = this.$options.shared;
            if (!shared)
                return;

            let vue = this;
            let vueOptions = this.$options;
            let computed = <Record<string, any>>(this.$options.computed = this.$options.computed || {});
            var data = <Record<string, any>>(vueOptions.data = vueOptions.data || {});
            let ctxRootData = <Record<string, any>>(data._shared_data = {});

            let provide = <Record<string, object>>(this.$options.provide = this.$options.provide || {});
            Object.keys(shared).forEach(key => {

                let ctxData = <Record<string, any>>(ctxRootData[key] = {});
                const ctxFn = shared[key];

                let name = key;

                let obj = typeof ctxFn === 'function' ? ctxFn.call(vueOptions) : ctxFn;
                let meta = getMetadata(obj);

                //if instance doesn't have any 'variables' we consider that it might have been patched already
                //so no patching.
                if (meta.variables.length > 0) {



                    //
                    for (let getterName in meta.getters) {
                        let fnName = '_computed_' + name + '_get_' + getterName;

                        Object.defineProperty(obj, getterName, {
                            get: function () { return (<Function>(<any>vue)[fnName]); },
                            enumerable: true,
                            configurable: true
                        });

                        computed[fnName] = meta.getters[getterName];
                    }

                    meta.variables.forEach(varName => {
                        ctxData[varName] = obj[varName];

                        Object.defineProperty(obj, varName, {
                            get: function () { return (<any>vue.$data)['_shared_data'][key][varName]; },
                            set: function (val) { (<any>vue.$data)['_shared_data'][key][varName] = val; },
                            enumerable: true,
                            configurable: true
                        });
                    });

                    let fnKeys = Object.keys(meta.functions);
                    if (fnKeys.length > 0) {

                        for (let fnName in meta.functions) {
                            let fn = meta.functions[fnName];
                            obj[fnName] = function () {
                                let args = [...arguments];
                                withinContext({ vue: vue, instance: obj, fnName: fnName, args: args }, () => fn.apply(obj, args));

                            }
                        }
                    }
                }
                provide[key] = obj;


            });
        }, mounted: function () {
            let shared = this.$options.shared;
            if (!shared)
                return;
            let vue = <Vue>this;

            Object.keys(shared).forEach(key => {
                let instance = this.$options.provide[key];
                vue.$watch('$data._shared_data.' + key, function (n: any, o: any) {
                    if (typeof o === 'undefined' && typeof n !== 'undefined')
                        return;

                    let ctx = currentContext();
                    if (!(o && ctx && ctx.instance === instance)) {
                        console.error('[vue-shared] Data should only be mutated from ' + key, n);
                    }


                }, { deep: true, immediate: true });

                if (typeof instance.mounted === 'function') {
                    instance.mounted(vue);
                }

            });
        }

    });
}



declare module 'vue/types/options' {
    interface ComponentOptions<V extends Vue> {
        shared?: Record<string, Function | object>;
    }
}

const VueShared = {
    install: install,
    currentContext: currentContext,
    withinContext: withinContext
};
export default VueShared;