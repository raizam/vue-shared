import Vue, { VueConstructor } from 'vue';
export interface CallContext {
    readonly instance: object;
    readonly fnName: string;
    readonly args: any[];
    readonly vue: Vue;
}
declare module 'vue/types/options' {
    interface ComponentOptions<V extends Vue> {
        shared?: Record<string, Function>;
    }
}
declare const Vush: {
    install: (vue: VueConstructor<Vue>, options?: any) => void;
    currentContext: () => CallContext;
    withinContext: (callContext: CallContext, action: () => void) => void;
};
export default Vush;
