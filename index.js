var OriginalReact = require('react-native');
var RCCManager = OriginalReact.NativeModules.RCCManager;
var NativeAppEventEmitter = OriginalReact.NativeAppEventEmitter;
var utils = require('./utils');
var resolveAssetSource = require('react-native/Libraries/Image/resolveAssetSource');
var processColor = require('react-native/Libraries/StyleSheet/processColor');

var _controllerRegistry = {};

function _getRandomId() {
  return (Math.random()*1e20).toString(36);
}

function _processProperties(properties) {
  for (var property in properties) {
    if (properties.hasOwnProperty(property)) {
      if (property === 'icon' || property.endsWith('Icon')) {
        properties[property] = resolveAssetSource(properties[property]);
      }
      if (property === 'color' || property.endsWith('Color')) {
        properties[property] = processColor(properties[property]);
      }
    }
  }
}

function _setListener(callbackId, func) {
  return NativeAppEventEmitter.addListener(callbackId, (...args) => func(...args));
}

function _processButtons(buttons) {
  var unsubscribes = [];
  for (var i = 0 ; i < buttons.length ; i++) {
    var button = buttons[i];
    _processProperties(button);
    if (typeof button.onPress === "function") {
      var onPressId = _getRandomId();
      var onPressFunc = button.onPress;
      button.onPress = onPressId;
      var unsubscribe = _setListener(onPressId, onPressFunc);
      unsubscribes.push(unsubscribe);
    }
  }
  return function () {
    for (var i = 0 ; i < unsubscribes.length ; i++) {
      if (unsubscribes[i]) { unsubscribes[i](); }
    }
  };
}

var Controllers = {

  createClass: function (app) {
    return app;
  },

  hijackReact: function () {
    return {
      createElement: function(type, props) {
        var children = Array.prototype.slice.call(arguments, 2);
        var flatChildren = utils.flattenDeep(children);
        _processProperties(props);
        if (props['style']) {
          _processProperties(props['style']);
        }
        return {
          'type': type.name,
          'props': props,
          'children': flatChildren
        };
      },

      ControllerRegistry: {
        registerController: function (appKey, getControllerFunc) {
          _controllerRegistry[appKey] = getControllerFunc();
        },
        setRootController: function (appKey) {
          var controller = _controllerRegistry[appKey];
          if (controller === undefined) return;
          var layout = controller.render();
          RCCManager.setRootController(layout);
        }
      },

      TabBarControllerIOS: {name: 'TabBarControllerIOS', Item: {name: 'TabBarControllerIOS.Item'}},
      NavigationControllerIOS: {name: 'NavigationControllerIOS'},
      ViewControllerIOS: {name: 'ViewControllerIOS'},
      DrawerControllerIOS: {name: 'DrawerControllerIOS'},
    };
  },

  NavigationControllerIOS: function (id) {
    return {
      push: function (params) {
        var unsubscribes = [];
        if (params['style']) {
          _processProperties(params['style']);
        }
        if (params['leftButtons']) {
          var unsubscribe = _processButtons(params['leftButtons']);
          unsubscribes.push(unsubscribe);
        }
        if (params['rightButtons']) {
          var unsubscribe = _processButtons(params['rightButtons']);
          unsubscribes.push(unsubscribe);
        }
        RCCManager.NavigationControllerIOS(id, "push", params);
        return function() {
          for (var i = 0 ; i < unsubscribes.length ; i++) {
            if (unsubscribes[i]) { unsubscribes[i](); }
          }
        };
      },
      pop: function (params) {
        RCCManager.NavigationControllerIOS(id, "pop", params);
      },
      setLeftButton: function () {
        console.error('setLeftButton is deprecated, see setLeftButtons');
      },
      setLeftButtons: function (buttons, animated = false) {
        var unsubscribe = _processButtons(buttons);
        RCCManager.NavigationControllerIOS(id, "setButtons", {buttons: buttons, side: "left", animated: animated});
        return unsubscribe;
      },
      setRightButtons: function (buttons, animated = false) {
        var unsubscribe = _processButtons(buttons);
        RCCManager.NavigationControllerIOS(id, "setButtons", {buttons: buttons, side: "right", animated: animated});
        return unsubscribe;
      }
    };
  },

  DrawerControllerIOS: function (id) {
    return {
      open: function (params) {
        return RCCManager.DrawerControllerIOS(id, "open", params);
      },
      close: function (params) {
        return RCCManager.DrawerControllerIOS(id, "close", params);
      },
      toggle: function (params) {
        return RCCManager.DrawerControllerIOS(id, "toggle", params);
      },
      setStyle: function (params) {
        return RCCManager.DrawerControllerIOS(id, "setStyle", params);
      }
    };
  },

};

module.exports = Controllers;
