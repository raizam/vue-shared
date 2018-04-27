# vue-shared
vue-shared is a tiny (~150 lines) vue plugin for shared state management, that can be used as an alternative to Vuex.
It adds a new vue option `shared` where the user sets objects that are shared with all descendent components.
vue-shared is simply *patching* the shared object supplied, and is using vue's provide/inject mechanism. 


## Shared objects

A shared object is a simple javascript object, with variables, methods and getters; accessible to all child components in the hierarchy.
vue-shared will transform the supplied instance such as:

* Variables are moved to the hosting Vue Component (hence become reactive). These variables are accessible to child components but are meant to be readonly (an error is logged when a child modifies it).
* Getters are turned into computed
* Methods are meant to be the only way to apply mutations, and are patched as well (in order to bypass the mutation protection).

## Usage

1. Define a class holding shared states
```javascript
  //a user to be shared
  class User
  {
    constructor(firstName, lastName) {
      //some reactive data
      this.firstName = firstName;
      this.lastName = lastName;
    }

    //computed
    get fullName(){ 
        return this.firstName + ' ' + this.lastName
    }

    //a mutation method
    updateFirstName(firstName)
    {
      this.firstName = firstName;
    }
  }

```

2. Install vue-shared: `npm i vue-shared`, import and assign a shared instance to a Vue instance.

```javascript
import Vue from 'vue'
import VueShared from 'vue-shared'

Vue.use(VueShared);

new Vue({
        el: "#app",
        shared:{ 
          $user: function(){ return new User('john', 'doe'); }
        }
      });
```
3. Inject the shared instance to a child component

```javascript
Vue.component('user-name', {
  inject: [ '$user' ],
  template: '<span>{{ $user.fullName }}</span>'
})
```

## Handling asynchronous mutations

vue-shared is using a watcher, listening to modifications and logs an error when a mutation hasn't been made from a method of the shared object itself.
When a mutation is asynchronous, it is needed to restore the `CallContext` in order to bypass the protection mechanism. 

This is done using the only 2 functions exposed: `currentContext` and `withinContext`

```javascript
  //a user to be shared
  class User
  {
     constructor(firstName, lastName) {
      //some reactive data
      this.firstName = firstName;
      this.lastName = lastName;
    }
    //asynchronous mutation
    updateUsername(){
       //retrieve current context before async call
       let ctx = VueShared.currentContext();
       
       //async call
       setTimeout(() =>{
       
        //reuse the context
        VueShared.withinContext(ctx, () =>{
        // apply mutations here
        this.firstName = 'John';
        this.lastName = 'Doe';
        
        });
       
       }, 2000);
    }
```

