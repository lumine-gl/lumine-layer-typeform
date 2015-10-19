(function(){

  var _ = require('lodash'),
      THREE = require('three'),
      Typeform = require('typeform');

  var ShaderPass = require('lumine').Passes.ShaderPass,
      Overlay2DShader = require('lumine').Shaders.overlay2d;

  var CONCURRENCY = 8,
      READ_BUFFER_SAMPLER = 't0',
      READ_BUFFER_UVC = 'cUv0',
      WRITE_SAMPLER = 't1',
      WRITE_UVC = 'cUv1',
      READ_UVO = 'oUv0',
      WRITE_UVO = 'oUv1';

  module.exports = function(Scene, canvas, lumine, layer){

    var pass = new ShaderPass(canvas.composer, Overlay2DShader, READ_BUFFER_SAMPLER);

    pass.uniforms[READ_BUFFER_UVC].value = new THREE.Vector2(1, 1);
    pass.uniforms[WRITE_UVC].value = new THREE.Vector2(1, 1);

    pass.uniforms[READ_UVO].value = new THREE.Vector2(0, 0);
    pass.uniforms[WRITE_UVO].value = new THREE.Vector2(0, 0);

    var _queue = [],
        _tf_ready = false,
        _tf = new Typeform({
          concurrency: CONCURRENCY,
          log: true,
          boxes: layer.boxes
        });

    _tf.start(function(){

      _tf_ready = true;

      _.each(_queue, function(queued){
        return queued();
      });

    });

    var map = null;

    var getMap = function(cb){

      var args = arguments,
          content = layer.content,
          css = layer.css;

      if(_tf_ready){

        _tf.render(
          content,
          {
            width: canvas.size.width,
            height: canvas.size.height,
            density: canvas.density
          },
          css,
          cb
        );

      }else{
        _queue.push(function(){
          return getMap.apply(null, args);
        });
      }

    };

    var setMap = function(cb){

      getMap(function(err, $canvas, u, v, boxes){

        if(boxes){
          // TODO: don't assume the Scene will only have one instance of typeform-document.
          Scene._lumine_layer_typeform_boxes = boxes;
        }

        var imageData = $canvas.getContext('2d').getImageData(0, 0, $canvas.width, $canvas.height);

        if(!map){
          map = new THREE.DataTexture(new Uint8Array(imageData.data), $canvas.width, $canvas.height, THREE.RGBAFormat);
          pass.uniforms[WRITE_SAMPLER].value = map;
        }else{
          map.image.data = new Uint8Array(imageData.data);
          map.image.width = $canvas.width;
          map.image.height = $canvas.height;
        }

        // adjust UV constant and UV offset

        pass.uniforms[WRITE_UVC].value.x = u;
        pass.uniforms[WRITE_UVC].value.y = v;
        pass.uniforms[WRITE_UVO].value.y = 1 - v;

        map.needsUpdate = true;

        if(_.isFunction(cb)) cb(null);

      });

    };

    setMap();

    // Listeners

    canvas.on('resize', function(){
      setMap();
    });

    return pass;

  };

})();