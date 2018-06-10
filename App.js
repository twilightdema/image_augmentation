var fs = require("fs");
var Jimp = require("jimp");
var Q = require('q');

var IMAGE_OUTPUT_WIDTH = 128;
var IMAGE_OUTPUT_HEIGHT = 128;
var RANDOM_CROP_COUNT = 50;
var MIN_RANDOM_CROP_PERCENTAGE = 30;

var RANDOM_ROTATE_COUNT = 50;
var MAX_RANDOM_ROTATE_DEGREE = 360;

var label = null;

var calculateLargestRect = function(angle, origWidth, origHeight) {
  var w0, h0;
  if (origWidth <= origHeight) {
      w0 = origWidth;
      h0 = origHeight;
  }
  else {
      w0 = origHeight;
      h0 = origWidth;
  }
  // Angle normalization in range [-PI..PI)
  var ang = angle - Math.floor((angle + Math.PI) / (2*Math.PI)) * 2*Math.PI; 
  ang = Math.abs(ang);      
  if (ang > Math.PI / 2)
      ang = Math.PI - ang;
  var sina = Math.sin(ang);
  var cosa = Math.cos(ang);
  var sinAcosA = sina * cosa;
  var w1 = w0 * cosa + h0 * sina;
  var h1 = w0 * sina + h0 * cosa;
  var c = h0 * sinAcosA / (2 * h0 * sinAcosA + w0);
  var x = w1 * c;
  var y = h1 * c;
  var w, h;
  if (origWidth <= origHeight) {
      w = w1 - 2 * x;
      h = h1 - 2 * y;
  }
  else {
      w = h1 - 2 * y;
      h = w1 - 2 * x;
  }
  return {
      w: w,
      h: h
  }
};

var performRandomCrop = function(image, start_i) {
	var deferred = Q.defer();
	try {
		var cropTasks = [];
		for (var i = start_i; i < start_i + RANDOM_CROP_COUNT / 2;i++) {
			var startX = Math.floor(Math.abs(Math.random()) * MIN_RANDOM_CROP_PERCENTAGE);
			var sizeX = 100 - Math.floor(Math.abs(Math.random()) * MIN_RANDOM_CROP_PERCENTAGE);
			var endX = (startX + sizeX > 100)?100:(startX + sizeX);

			console.log('Crop from ('+startX+','+startX+')x('+endX+','+endX+')');
			var start_exact = Math.floor(startX * IMAGE_OUTPUT_WIDTH / 100);
			var end_exact = Math.floor(endX * IMAGE_OUTPUT_WIDTH / 100);
			var size_exact = end_exact - start_exact;

			cropTasks.push({
				i: i,
				image: image,
				start_exact: start_exact,
				size_exact: size_exact,
			});
		}
		for (var i = start_i + RANDOM_CROP_COUNT / 2 + 1; i< start_i + RANDOM_CROP_COUNT;i++) {
			var endX = 50 + Math.floor(Math.abs(Math.random()) * MIN_RANDOM_CROP_PERCENTAGE);
			var sizeX = 100 - Math.floor(Math.abs(Math.random()) * MIN_RANDOM_CROP_PERCENTAGE);
			var startX = (endX - sizeX < 0)?0:(endX - sizeX);

			console.log('Crop from ('+startX+','+startX+')x('+endX+','+endX+')');
			var start_exact = Math.floor(startX * IMAGE_OUTPUT_WIDTH / 100);
			var end_exact = Math.floor(endX * IMAGE_OUTPUT_WIDTH / 100);
			var size_exact = end_exact - start_exact;

			cropTasks.push({
				i: i,
				image: image,
				start_exact: start_exact,
				size_exact: size_exact,
			});
		}

		var performRandomCropTask = function(task) {
			var deferred = Q.defer();
			console.log('Perform: ' + task.i + ' -> crop '+task.start_exact+', size='+task.size_exact);
			var croppedImage = image.clone()
				.brightness(Math.random() - 0.5)
				//.fade(Math.random() * 0.5 + 0.5)
				//.blur(Math.round(Math.random() * 5))
				.cover(IMAGE_OUTPUT_WIDTH, IMAGE_OUTPUT_HEIGHT).crop(task.start_exact, task.start_exact, task.size_exact, task.size_exact).cover(IMAGE_OUTPUT_WIDTH, IMAGE_OUTPUT_HEIGHT);
			croppedImage/*.quality(60)*/.write('outputs/' + label+'/crop_'+task.i+'.jpg', function() {
				performRandomRotateCrop(croppedImage, task.i, 0).then(() => {
					deferred.resolve();
				});
			});
			return deferred.promise;
		};

		cropTasks.reduce((promise, task)=>{
			return promise.then(()=>{
				return performRandomCropTask(task);
			});
		}, Q() ).then(()=>{
			deferred.resolve();
		});

	} catch(err) {
		console.log(err);
		deferred.reject(err);
	}
	return deferred.promise;
};

var performRandomRotateCrop = function(image, task_id, start_i) {
	var deferred = Q.defer();
	try {
		var rotateTasks = [];
		for (var i = start_i; i < start_i + RANDOM_CROP_COUNT;i++) {
			var rotate_angle = Math.floor(Math.abs(Math.random()) * MAX_RANDOM_ROTATE_DEGREE);

			console.log('Rotate to ('+rotate_angle+')');

			rotateTasks.push({
				i: i,
				image: image,
				rotate_angle: rotate_angle,
			});
		}

		var performRandomRotateCropTask = function(task) {
			var deferred = Q.defer();
			console.log('Perform: ' + task.i + ' -> rotate '+task.rotate_angle);

			var croppedSize = calculateLargestRect(task.rotate_angle, IMAGE_OUTPUT_WIDTH, IMAGE_OUTPUT_HEIGHT);
			var crop_x = (IMAGE_OUTPUT_WIDTH - croppedSize.w) / 2;
			var crop_y = (IMAGE_OUTPUT_HEIGHT - croppedSize.h) / 2;
			var crop_w = croppedSize.w;
			var crop_h = croppedSize.h;

			var rotatedImage = image.clone().background(Math.round(Math.random() * 0xFFFFFFFF))
				.brightness(Math.random() - 0.5)
				//.fade(Math.random() * 0.5 + 0.5)
				//.blur(Math.round(Math.random() * 5))
				.cover(IMAGE_OUTPUT_WIDTH, IMAGE_OUTPUT_HEIGHT)
				.rotate(task.rotate_angle, false)
				.crop(crop_x, crop_y, crop_w, crop_h)
				.cover(IMAGE_OUTPUT_WIDTH, IMAGE_OUTPUT_HEIGHT)
				;

			rotatedImage/*.quality(60)*/.write('outputs/' + label+'/rotate_'+task_id+'_'+task.i+'.jpg', function() {
				deferred.resolve();
			});
			return deferred.promise;
		};

		rotateTasks.reduce((promise, task)=>{
			return promise.then(()=>{
				return performRandomRotateCropTask(task);
			});
		}, Q() ).then(()=>{
			deferred.resolve();
		});

	} catch(err) {
		console.log(err);
		deferred.reject(err);
	}
	return deferred.promise;
};

// Program parameter
if (process.argv.length < 3) {
	console.log('USAGE: node App.js <PARAMETER>');
	console.log('Parameter Value:');
	console.log(' augment <Image File> <Label>: Create augmented training data of a image file and save to label folder.');
	return;
}

if (process.argv[2]==='augment') {
	if (process.argv.length < 5) {
		console.log(' augment <Image File> <Label>: Create augmented training data of a image file and save to label folder.');
		return;
	}
	var image_file = process.argv[3];
	label = process.argv[4];

	// Create output directory
	if (!fs.existsSync('outputs/' + label)){
		fs.mkdirSync('outputs/' + label);
	}

	// Load original image
	Jimp.read(image_file).then(function (image) {
    // do stuff with the image
    image.write('outputs/' + label + '/original.jpg');

    console.log('Scale image to fill size of '+IMAGE_OUTPUT_WIDTH+'x'+IMAGE_OUTPUT_HEIGHT);
    image = image.cover(IMAGE_OUTPUT_WIDTH, IMAGE_OUTPUT_HEIGHT);

    image.write('outputs/' + label + '/original_scaled.jpg');

    performRandomCrop(image, 0).then(() => {
    	console.log('Finish.');
    });

	}).catch(function (err) {
    // handle an exception
    console.log(err);
	});

}
