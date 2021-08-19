/*===========================================================================================
                       SAR-FLOOD MAPPING USING A CHANGE DETECTION APPROACH
  ===========================================================================================
  This script uses SAR Sentil-1 GDR images to generate flood extent maps. This code extracts
  flooding extents for all admin codes of a given country. Change detection was used to compare
  before- and after- flood event images. Ground Range Detected imagery already includes the
  following preprocessing steps: Thermal-Noise Removal, Radiometric calibration, Terrain-
  correction hence only a Speckle filter needs to be applied in the preprocessing.

  Adapted from this tutorial: https://www.youtube.com/watch?v=tT9iD9wRzUo

  Access code in GEE: https://code.earthengine.google.com/44c6061d4597bf2ec6c4cffcfee5028f

//===========================================================================================
                                  IMPORT NECESSARY DATASETS

  Run in Google Earth Engine after importing the following (note variable names)

    - Admin2: FAO Admin Level 2
    - s1: Sentinel 1 SAR GRD
    - JRC: JRC Global surface water mapping layers, v1.3
    - WWF: WWF HydroSHEDS Void-filled DEM

/*******************************************************************************************
                                  SELECT YOUR OWN STUDY AREA
                                   (Set country of interest)*/

var country = 'Burkina Faso';

/*******************************************************************************************
                                       SET TIME FRAME
                               (Set start date of a flooding event)*/

var flood_event = new Date('2016-09-14');

/********************************************************************************************
                           SET SAR PARAMETERS (can be left default)*/

var polarization = 'VH'; /*or 'VV' --> VH mostly is the preferred polarization for flood mapping.
                           However, it always depends on your study area, you can select 'VV'
                           as well.*/
var pass_direction = 'ASCENDING'; /* or 'DESCENDING' when images are being compared use only one
                           pass direction. Consider changing this parameter, if your image
                           collection is empty. In some areas more Ascending images exist than
                           than descending or the other way around.*/
var difference_threshold = 1.25; /*threshold to be applied on the difference image (after flood
                           - before flood). It has been chosen by trial and error. In case your
                           flood extent result shows many false-positive or negative signals,
                           consider changing it! */


/********************************************************************************************
  ---->>> DO NOT EDIT THE SCRIPT PAST THIS POINT! (unless you know what you are doing) <<<---
  ------------------>>> now hit the'RUN' at the top of the script! <<<-----------------------
  -----> The final flood product will be ready for download on the right (under tasks) <-----

  ******************************************************************************************/

//---------------------------------- Translating User Inputs ------------------------------//

//------------------------------- DATA SELECTION & PREPROCESSING --------------------------//

// FOR SINGLE DATE
var before_event = new Date(flood_event);
before_event.setDate(before_event.getDate() - 24); // Before the flood
var after_event = new Date(flood_event);
after_event.setDate(after_event.getDate() + 24); // After the flood


// FOR EVERY FEATURE IN ADMIN2
var admin2 = ee.FeatureCollection(Admin2)
  .filter(ee.Filter.eq('ADM0_NAME', country));

var for_every_feature = function(feature) {

  feature = ee.Image(feature);

  // Create geometry of feature
  var geometry = feature.geometry();
  // Map.addLayer(geometry, {color: 'grey'}, 'Selected District')

  // Filter satellite data to geometry
  var collection = s1
    .filter(ee.Filter.eq('instrumentMode','IW')) // this is the sentinel band we are interested in
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', polarization))
    .filter(ee.Filter.eq('orbitProperties_pass', pass_direction))
    .filter(ee.Filter.eq('resolution_meters', 10)) // makes sure you get the same resolution data
    .filterBounds(geometry)
    .select(polarization);

  // Extract before and after images
  var beforeCollection = collection.filterDate(before_event, flood_event);
  var afterCollection = collection.filterDate(flood_event, after_event);
  var before = beforeCollection.mosaic().clip(geometry); // takes the most recent image of collection
  var after = afterCollection.first().clip(geometry); // takes the first image of collection // NOTE: There are some issues with early Sentinel images (prior to 2016)

  // Smooth Images w/ Speckle Filtering Function (Below)
  var beforeFiltered = ee.Image(toDB(RefinedLee(toNatural(before))));
  var afterFiltered = ee.Image(toDB(RefinedLee(toNatural(after))));

    // Subtract difference between the before and after (Division is best method here)
  var difference = afterFiltered.divide(beforeFiltered);
  // Define Threshold
  var diffThreshold = difference_threshold;
  // INITIAL ESTIMATE of flooded pixels
  var flooded = difference.gt(diffThreshold).rename('water').selfMask();

  // Remove all semi-permenant bodies of water w/ JRC
  var permanentWater = ee.Image(JRC.select('seasonality').gte(5).clip(geometry)); // any  pixel that has water 5 months out of the year is a permenant body
  var flooded2 = flooded.where(permanentWater,0).selfMask();

  // Remove areas with high slope w/ WWF Hydroshed
  var slopeThreshold = 5; // depends on region
  var terrain = ee.Algorithms.Terrain(WWF);
  var slope = terrain.select('slope');
  var flooded3 = flooded2.updateMask(slope.lt(slopeThreshold));
  var connectedPixelsThreshold = 8;
  var connections = flooded3.connectedPixelCount(25);

  // ACTUAL AREA of flooded pixels
  var flooded_area = flooded3.updateMask(connections.gt(connectedPixelsThreshold));

  // Extract sum of flooded area
  var floodedSum = flooded_area.reduceRegion({
    geometry: geometry, // boundary shape file
    reducer: ee.Reducer.sum(),
    scale: 150, // IMPORTANT - Don't go below 50 that will exceed memory
    bestEffort: true,
  });
  var floodedSum2 = ee.Number(floodedSum.get('water'))

  return feature.set({Diff: floodedSum2});

};

var flood_diff = admin2.map(for_every_feature);
print(flood_diff);

// Export the FeatureCollection.
Export.table.toDrive({
  collection: flood_diff,
  description: 'FloodedDiff',
  fileFormat: 'CSV'
});



// ##########################
// Speckle Filtering Function
// ##########################

// Function to convert from dB
function toNatural(img) {
  return ee.Image(10.0).pow(img.select(0).divide(10.0));
}

//Function to convert to dB
function toDB(img) {
  return ee.Image(img).log10().multiply(10.0);
}

//Apllying a Refined Lee Speckle filter as coded in the SNAP 3.0 S1TBX:

//https://github.com/senbox-org/s1tbx/blob/master/s1tbx-op-sar-processing/src/main/java/org/esa/s1tbx/sar/gpf/filtering/SpeckleFilters/RefinedLee.java
//Adapted by Guido Lemoine

// by Guido Lemoine
function RefinedLee(img) {
  // img must be in natural units, i.e. not in dB!
  // Set up 3x3 kernels
  var weights3 = ee.List.repeat(ee.List.repeat(1,3),3);
  var kernel3 = ee.Kernel.fixed(3,3, weights3, 1, 1, false);

  var mean3 = img.reduceNeighborhood(ee.Reducer.mean(), kernel3);
  var variance3 = img.reduceNeighborhood(ee.Reducer.variance(), kernel3);

  // Use a sample of the 3x3 windows inside a 7x7 windows to determine gradients and directions
  var sample_weights = ee.List([[0,0,0,0,0,0,0], [0,1,0,1,0,1,0],[0,0,0,0,0,0,0], [0,1,0,1,0,1,0], [0,0,0,0,0,0,0], [0,1,0,1,0,1,0],[0,0,0,0,0,0,0]]);

  var sample_kernel = ee.Kernel.fixed(7,7, sample_weights, 3,3, false);

  // Calculate mean and variance for the sampled windows and store as 9 bands
  var sample_mean = mean3.neighborhoodToBands(sample_kernel);
  var sample_var = variance3.neighborhoodToBands(sample_kernel);

  // Determine the 4 gradients for the sampled windows
  var gradients = sample_mean.select(1).subtract(sample_mean.select(7)).abs();
  gradients = gradients.addBands(sample_mean.select(6).subtract(sample_mean.select(2)).abs());
  gradients = gradients.addBands(sample_mean.select(3).subtract(sample_mean.select(5)).abs());
  gradients = gradients.addBands(sample_mean.select(0).subtract(sample_mean.select(8)).abs());

  // And find the maximum gradient amongst gradient bands
  var max_gradient = gradients.reduce(ee.Reducer.max());

  // Create a mask for band pixels that are the maximum gradient
  var gradmask = gradients.eq(max_gradient);

  // duplicate gradmask bands: each gradient represents 2 directions
  gradmask = gradmask.addBands(gradmask);

  // Determine the 8 directions
  var directions = sample_mean.select(1).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(7))).multiply(1);
  directions = directions.addBands(sample_mean.select(6).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(2))).multiply(2));
  directions = directions.addBands(sample_mean.select(3).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(5))).multiply(3));
  directions = directions.addBands(sample_mean.select(0).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(8))).multiply(4));
  // The next 4 are the not() of the previous 4
  directions = directions.addBands(directions.select(0).not().multiply(5));
  directions = directions.addBands(directions.select(1).not().multiply(6));
  directions = directions.addBands(directions.select(2).not().multiply(7));
  directions = directions.addBands(directions.select(3).not().multiply(8));

  // Mask all values that are not 1-8
  directions = directions.updateMask(gradmask);

  // "collapse" the stack into a singe band image (due to masking, each pixel has just one value (1-8) in it's directional band, and is otherwise masked)
  directions = directions.reduce(ee.Reducer.sum());

  //var pal = ['ffffff','ff0000','ffff00', '00ff00', '00ffff', '0000ff', 'ff00ff', '000000'];
  //Map.addLayer(directions.reduce(ee.Reducer.sum()), {min:1, max:8, palette: pal}, 'Directions', false);

  var sample_stats = sample_var.divide(sample_mean.multiply(sample_mean));

  // Calculate localNoiseVariance
  var sigmaV = sample_stats.toArray().arraySort().arraySlice(0,0,5).arrayReduce(ee.Reducer.mean(), [0]);

  // Set up the 7*7 kernels for directional statistics
  var rect_weights = ee.List.repeat(ee.List.repeat(0,7),3).cat(ee.List.repeat(ee.List.repeat(1,7),4));

  var diag_weights = ee.List([[1,0,0,0,0,0,0], [1,1,0,0,0,0,0], [1,1,1,0,0,0,0],
    [1,1,1,1,0,0,0], [1,1,1,1,1,0,0], [1,1,1,1,1,1,0], [1,1,1,1,1,1,1]]);

  var rect_kernel = ee.Kernel.fixed(7,7, rect_weights, 3, 3, false);
  var diag_kernel = ee.Kernel.fixed(7,7, diag_weights, 3, 3, false);

  // Create stacks for mean and variance using the original kernels. Mask with relevant direction.
  var dir_mean = img.reduceNeighborhood(ee.Reducer.mean(), rect_kernel).updateMask(directions.eq(1));
  var dir_var = img.reduceNeighborhood(ee.Reducer.variance(), rect_kernel).updateMask(directions.eq(1));

  dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), diag_kernel).updateMask(directions.eq(2)));
  dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), diag_kernel).updateMask(directions.eq(2)));

  // and add the bands for rotated kernels
  for (var i=1; i<4; i++) {
    dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), rect_kernel.rotate(i)).updateMask(directions.eq(2*i+1)));
    dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), rect_kernel.rotate(i)).updateMask(directions.eq(2*i+1)));
    dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), diag_kernel.rotate(i)).updateMask(directions.eq(2*i+2)));
    dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), diag_kernel.rotate(i)).updateMask(directions.eq(2*i+2)));
  }

  // "collapse" the stack into a single band image (due to masking, each pixel has just one value in it's directional band, and is otherwise masked)
  dir_mean = dir_mean.reduce(ee.Reducer.sum());
  dir_var = dir_var.reduce(ee.Reducer.sum());

  // A finally generate the filtered value
  var varX = dir_var.subtract(dir_mean.multiply(dir_mean).multiply(sigmaV)).divide(sigmaV.add(1.0));

  var b = varX.divide(dir_var);

  var result = dir_mean.add(b.multiply(img.subtract(dir_mean)));
  return(result.arrayFlatten([['sum']]));
}
