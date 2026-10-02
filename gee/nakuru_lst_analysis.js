// ============================================================
// NAKURU CITY URBAN HEAT ISLAND STUDY
// LANDSAT SEASONAL LST + NDVI + NDBI + NDWI
//
// Years: 2010, 2014, 2018, 2021, 2022, 2024, 2026
//
// Dry season: January - February
// Wet season: July - August (2010)
//             April - May (2014 onward)
// ============================================================


// ============================================================
// 1. STUDY AREA
// ============================================================

// Use the Nakuru City boundary
var studyArea = ee.FeatureCollection(
  nakuru
).geometry();

Map.centerObject(studyArea, 11);


// ============================================================
// 2. YEARS
// ============================================================

var years = [
  2010,
  2014,
  2018,
  2021,
  2022,
  2024,
  2026
];


// ============================================================
// 3. LANDSAT COLLECTIONS
// ============================================================

var L5 = ee.ImageCollection(
  'LANDSAT/LT05/C02/T1_L2'
);

var L7 = ee.ImageCollection(
  'LANDSAT/LE07/C02/T1_L2'
);

var L8 = ee.ImageCollection(
  'LANDSAT/LC08/C02/T1_L2'
);

var L9 = ee.ImageCollection(
  'LANDSAT/LC09/C02/T1_L2'
);


// ============================================================
// 4. CLOUD AND PIXEL MASKING
// ============================================================

function maskLandsat(image) {

  var qa = image.select('QA_PIXEL');

  // Remove poor-quality pixels
  var qaMask = qa.bitwiseAnd(1 << 0).eq(0) // Fill
    .and(qa.bitwiseAnd(1 << 1).eq(0))      // Dilated cloud
    .and(qa.bitwiseAnd(1 << 2).eq(0))      // Cirrus
    .and(qa.bitwiseAnd(1 << 3).eq(0))      // Cloud
    .and(qa.bitwiseAnd(1 << 4).eq(0))      // Cloud shadow
    .and(qa.bitwiseAnd(1 << 5).eq(0));     // Snow

  // Remove saturated pixels
  var saturationMask = image
    .select('QA_RADSAT')
    .eq(0);

  return image
    .updateMask(qaMask)
    .updateMask(saturationMask)
    .copyProperties(
      image,
      ['system:time_start']
    );

}


// ============================================================
// 5. SCALE LANDSAT BANDS
// ============================================================

function scaleLandsat(image) {

  // Scale surface reflectance bands
  var optical = image
    .select('SR_B.*')
    .multiply(0.0000275)
    .add(-0.2);

  // Scale thermal bands
  var thermal = image
    .select('ST_B.*')
    .multiply(0.00341802)
    .add(149.0);

  // Replace the original values
  return image
    .addBands(
      optical,
      null,
      true
    )
    .addBands(
      thermal,
      null,
      true
    );

}


// ============================================================
// 6. STANDARDIZE LANDSAT 5 / 7 BANDS
// ============================================================

function standardizeL57(image) {

  return image.select(

    [
      'SR_B1',
      'SR_B2',
      'SR_B3',
      'SR_B4',
      'SR_B5',
      'SR_B7',
      'ST_B6'
    ],

    [
      'Blue',
      'Green',
      'Red',
      'NIR',
      'SWIR1',
      'SWIR2',
      'LST_K'
    ]

  );

}


// ============================================================
// 7. STANDARDIZE LANDSAT 8 / 9 BANDS
// ============================================================

function standardizeL89(image) {

  return image.select(

    [
      'SR_B2',
      'SR_B3',
      'SR_B4',
      'SR_B5',
      'SR_B6',
      'SR_B7',
      'ST_B10'
    ],

    [
      'Blue',
      'Green',
      'Red',
      'NIR',
      'SWIR1',
      'SWIR2',
      'LST_K'
    ]

  );

}


// ============================================================
// 8. PROCESS LANDSAT DATA
// ============================================================

var L5_processed = L5
  .map(maskLandsat)
  .map(scaleLandsat)
  .map(standardizeL57);

var L7_processed = L7
  .map(maskLandsat)
  .map(scaleLandsat)
  .map(standardizeL57);

var L8_processed = L8
  .map(maskLandsat)
  .map(scaleLandsat)
  .map(standardizeL89);

var L9_processed = L9
  .map(maskLandsat)
  .map(scaleLandsat)
  .map(standardizeL89);


// ============================================================
// 9. GET SEASONAL LANDSAT DATA
// ============================================================

function getSeasonCollection(
  year,
  seasonName
) {

  var startMonth;
  var endMonth;

  // Dry season: January - February
  if (seasonName === 'dry') {

    startMonth = 1;
    endMonth = 2;

  }

  // Wet season
  else {

    // 2010 uses July - August
    if (year === 2010) {

      startMonth = 7;
      endMonth = 8;

    }

    // Other years use April - May
    else {

      startMonth = 4;
      endMonth = 5;

    }

  }

  // Set the start of the season
  var startDate = ee.Date.fromYMD(
    year,
    startMonth,
    1
  );

  // Set the end of the season
  var endDate = ee.Date.fromYMD(
    year,
    endMonth,
    1
  ).advance(
    1,
    'month'
  );

  var collection;

  // 2010: Landsat 5
  if (year === 2010) {

    collection = L5_processed;

  }

  // 2014, 2018 and 2021: Landsat 8
  else if (
    year === 2014 ||
    year === 2018 ||
    year === 2021
  ) {

    collection = L8_processed;

  }

  // 2022 onward: Landsat 8 + Landsat 9
  else {

    collection = L8_processed.merge(
      L9_processed
    );

  }

  return collection
    .filterBounds(studyArea)
    .filterDate(
      startDate,
      endDate
    );

}


// ============================================================
// 10. CREATE SEASONAL COMPOSITES
// ============================================================

function createComposite(
  year,
  seasonName
) {

  var collection = getSeasonCollection(
    year,
    seasonName
  );

  var count = collection.size();

  print(
    year + ' ' +
    (seasonName === 'dry' ? 'Dry' : 'Wet') +
    ' image count:',
    count
  );

  // Empty image for seasons with no available imagery
  var emptyImage = ee.Image.constant([
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ])
  .rename([
    'Blue',
    'Green',
    'Red',
    'NIR',
    'SWIR1',
    'SWIR2',
    'LST_K'
  ])
  .updateMask(
    ee.Image(0)
  );

  // Create a median seasonal composite
  var composite = ee.Image(
    ee.Algorithms.If(
      count.gt(0),
      collection.median(),
      emptyImage
    )
  );

  composite = composite.clip(
    studyArea
  );

  // Convert LST from Kelvin to Celsius
  var lstC = composite
    .select('LST_K')
    .subtract(273.15)
    .rename('LST_C');

  // Calculate NDVI
  var ndvi = composite
    .normalizedDifference([
      'NIR',
      'Red'
    ])
    .rename('NDVI');

  // Calculate NDBI
  var ndbi = composite
    .normalizedDifference([
      'SWIR1',
      'NIR'
    ])
    .rename('NDBI');

  // Calculate NDWI
  var ndwi = composite
    .normalizedDifference([
      'Green',
      'NIR'
    ])
    .rename('NDWI');

  return composite
    .addBands(lstC)
    .addBands(ndvi)
    .addBands(ndbi)
    .addBands(ndwi)
    .set({

      'year': year,

      'season':
        seasonName === 'dry'
        ? 'Dry'
        : 'Wet',

      'image_count': count

    });

}


// ============================================================
// 11. VISUALIZATION SETTINGS
// ============================================================

// LST
var lstVis = {

  min: 15,

  max: 55,

  palette: [
    '040274',
    '2c7bb6',
    'abd9e9',
    'ffffbf',
    'fdae61',
    'd7191c'
  ]

};

// NDVI
var ndviVis = {

  min: -0.5,

  max: 1,

  palette: [
    '8c510a',
    'd8b365',
    'f6e8c3',
    'c7eae5',
    '5ab4ac',
    '01665e'
  ]

};

// NDBI
var ndbiVis = {

  min: -0.5,

  max: 0.6,

  palette: [
    '2166ac',
    '67a9cf',
    'd1e5f0',
    'fddbc7',
    'ef8a62',
    'b2182b'
  ]

};

// NDWI
var ndwiVis = {

  min: -0.5,

  max: 0.8,

  palette: [
    '8c510a',
    'd8b365',
    'f6e8c3',
    'c7eae5',
    '5ab4ac',
    '01665e'
  ]

};


// ============================================================
// 12. CREATE ALL COMPOSITES
// ============================================================

var composites = {};


// ============================================================
// 13. RUN THE ANALYSIS FOR EACH YEAR
// ============================================================

years.forEach(function(year) {

  // Dry season
  var dry = createComposite(
    year,
    'dry'
  );

  composites[
    year + '_dry'
  ] = dry;

  // Wet season
  var wet = createComposite(
    year,
    'wet'
  );

  composites[
    year + '_wet'
  ] = wet;

  // Dry-season LST statistics
  var dryStats = dry
    .select('LST_C')
    .reduceRegion({

      reducer:
        ee.Reducer.minMax()
        .combine({

          reducer2:
            ee.Reducer.mean(),

          sharedInputs: true

        }),

      geometry:
        studyArea,

      scale:
        30,

      maxPixels:
        1e13

    });

  print(
    year + ' Dry LST statistics:',
    dryStats
  );

  // Wet-season LST statistics
  var wetStats = wet
    .select('LST_C')
    .reduceRegion({

      reducer:
        ee.Reducer.minMax()
        .combine({

          reducer2:
            ee.Reducer.mean(),

          sharedInputs: true

        }),

      geometry:
        studyArea,

      scale:
        30,

      maxPixels:
        1e13

    });

  print(
    year + ' Wet LST statistics:',
    wetStats
  );

  // Dry-season NDVI statistics
  var dryNDVIStats = dry
    .select('NDVI')
    .reduceRegion({

      reducer:
        ee.Reducer.minMax()
        .combine({

          reducer2:
            ee.Reducer.mean(),

          sharedInputs: true

        }),

      geometry:
        studyArea,

      scale:
        30,

      maxPixels:
        1e13

    });

  print(
    year + ' Dry NDVI statistics:',
    dryNDVIStats
  );

  // Wet-season NDVI statistics
  var wetNDVIStats = wet
    .select('NDVI')
    .reduceRegion({

      reducer:
        ee.Reducer.minMax()
        .combine({

          reducer2:
            ee.Reducer.mean(),

          sharedInputs: true

        }),

      geometry:
        studyArea,

      scale:
        30,

      maxPixels:
        1e13

    });

  print(
    year + ' Wet NDVI statistics:',
    wetNDVIStats
  );

  // Dry-season NDBI statistics
  var dryNDBIStats = dry
    .select('NDBI')
    .reduceRegion({

      reducer:
        ee.Reducer.minMax()
        .combine({

          reducer2:
            ee.Reducer.mean(),

          sharedInputs: true

        }),

      geometry:
        studyArea,

      scale:
        30,

      maxPixels:
        1e13

    });

  print(
    year + ' Dry NDBI statistics:',
    dryNDBIStats
  );

  // Wet-season NDBI statistics
  var wetNDBIStats = wet
    .select('NDBI')
    .reduceRegion({

      reducer:
        ee.Reducer.minMax()
        .combine({

          reducer2:
            ee.Reducer.mean(),

          sharedInputs: true

        }),

      geometry:
        studyArea,

      scale:
        30,

      maxPixels:
        1e13

    });

  print(
    year + ' Wet NDBI statistics:',
    wetNDBIStats
  );

});


// ============================================================
// 14. DISPLAY 2026 DRY SEASON
// ============================================================

var dry2026 =
  composites['2026_dry'];

Map.addLayer(
  dry2026.select('LST_C'),
  lstVis,
  '2026 Dry LST'
);

Map.addLayer(
  dry2026.select('NDVI'),
  ndviVis,
  '2026 Dry NDVI',
  false
);

Map.addLayer(
  dry2026.select('NDBI'),
  ndbiVis,
  '2026 Dry NDBI',
  false
);

Map.addLayer(
  dry2026.select('NDWI'),
  ndwiVis,
  '2026 Dry NDWI',
  false
);


// ============================================================
// 15. DISPLAY 2026 WET SEASON
// ============================================================

var wet2026 =
  composites['2026_wet'];

Map.addLayer(
  wet2026.select('LST_C'),
  lstVis,
  '2026 Wet LST',
  false
);

Map.addLayer(
  wet2026.select('NDVI'),
  ndviVis,
  '2026 Wet NDVI',
  false
);

Map.addLayer(
  wet2026.select('NDBI'),
  ndbiVis,
  '2026 Wet NDBI',
  false
);

Map.addLayer(
  wet2026.select('NDWI'),
  ndwiVis,
  '2026 Wet NDWI',
  false
);


// ============================================================
// 16. HISTORICAL DRY-SEASON LST
// ============================================================

Map.addLayer(
  composites['2010_dry'].select('LST_C'),
  lstVis,
  '2010 Dry LST',
  false
);

Map.addLayer(
  composites['2014_dry'].select('LST_C'),
  lstVis,
  '2014 Dry LST',
  false
);

Map.addLayer(
  composites['2018_dry'].select('LST_C'),
  lstVis,
  '2018 Dry LST',
  false
);

Map.addLayer(
  composites['2021_dry'].select('LST_C'),
  lstVis,
  '2021 Dry LST',
  false
);

Map.addLayer(
  composites['2022_dry'].select('LST_C'),
  lstVis,
  '2022 Dry LST',
  false
);

Map.addLayer(
  composites['2024_dry'].select('LST_C'),
  lstVis,
  '2024 Dry LST',
  false
);


// ============================================================
// 17. HISTORICAL WET-SEASON LST
// ============================================================

Map.addLayer(
  composites['2010_wet'].select('LST_C'),
  lstVis,
  '2010 Wet LST',
  false
);

Map.addLayer(
  composites['2014_wet'].select('LST_C'),
  lstVis,
  '2014 Wet LST',
  false
);

Map.addLayer(
  composites['2018_wet'].select('LST_C'),
  lstVis,
  '2018 Wet LST',
  false
);

Map.addLayer(
  composites['2021_wet'].select('LST_C'),
  lstVis,
  '2021 Wet LST',
  false
);

Map.addLayer(
  composites['2022_wet'].select('LST_C'),
  lstVis,
  '2022 Wet LST',
  false
);

Map.addLayer(
  composites['2024_wet'].select('LST_C'),
  lstVis,
  '2024 Wet LST',
  false
);


// ============================================================
// 18. VIEW ALL COMPOSITES
// ============================================================

print(
  'All seasonal composites:',
  composites
);


// ============================================================
// 19. SEASON DEFINITIONS
// ============================================================

print(
  'Season definitions:',
  'Dry = January-February; ' +
  'Wet = July-August for 2010; ' +
  'Wet = April-May for 2014 onward.'
);


// ============================================================
// LST PERCENTILE CHECK
// ============================================================

function printLSTPercentiles(image, label) {

  var percentiles = image
    .select('LST_C')
    .reduceRegion({
      reducer: ee.Reducer.percentile([
        1,
        5,
        10,
        25,
        50,
        75,
        90,
        95,
        99
      ]),
      geometry: studyArea,
      scale: 30,
      maxPixels: 1e13,
      bestEffort: true
    });

  print(
    label + ' LST percentiles:',
    percentiles
  );
}


// 2010
printLSTPercentiles(
  composites['2010_dry'],
  '2010 Dry'
);


// 2014
printLSTPercentiles(
  composites['2014_dry'],
  '2014 Dry'
);

printLSTPercentiles(
  composites['2014_wet'],
  '2014 Wet'
);


// 2018
printLSTPercentiles(
  composites['2018_dry'],
  '2018 Dry'
);

printLSTPercentiles(
  composites['2018_wet'],
  '2018 Wet'
);


// 2021
printLSTPercentiles(
  composites['2021_dry'],
  '2021 Dry'
);

printLSTPercentiles(
  composites['2021_wet'],
  '2021 Wet'
);


// 2022
printLSTPercentiles(
  composites['2022_dry'],
  '2022 Dry'
);

printLSTPercentiles(
  composites['2022_wet'],
  '2022 Wet'
);


// 2024
printLSTPercentiles(
  composites['2024_dry'],
  '2024 Dry'
);

printLSTPercentiles(
  composites['2024_wet'],
  '2024 Wet'
);


// 2026
printLSTPercentiles(
  composites['2026_dry'],
  '2026 Dry'
);

printLSTPercentiles(
  composites['2026_wet'],
  '2026 Wet'
);


// ============================================================
// NDVI AND NDBI PERCENTILES
// ============================================================

function printIndexPercentiles(image, label) {

  var stats = image
    .select(['NDVI', 'NDBI'])
    .reduceRegion({
      reducer: ee.Reducer.percentile([
        1,
        5,
        10,
        25,
        50,
        75,
        90,
        95,
        99
      ]),
      geometry: studyArea,
      scale: 30,
      maxPixels: 1e13,
      bestEffort: true
    });

  print(
    label + ' NDVI/NDBI percentiles:',
    stats
  );
}


// 2010
printIndexPercentiles(
  composites['2010_dry'],
  '2010 Dry'
);


// 2014
printIndexPercentiles(
  composites['2014_dry'],
  '2014 Dry'
);

printIndexPercentiles(
  composites['2014_wet'],
  '2014 Wet'
);


// 2018
printIndexPercentiles(
  composites['2018_dry'],
  '2018 Dry'
);

printIndexPercentiles(
  composites['2018_wet'],
  '2018 Wet'
);


// 2021
printIndexPercentiles(
  composites['2021_dry'],
  '2021 Dry'
);

printIndexPercentiles(
  composites['2021_wet'],
  '2021 Wet'
);


// 2022
printIndexPercentiles(
  composites['2022_dry'],
  '2022 Dry'
);

printIndexPercentiles(
  composites['2022_wet'],
  '2022 Wet'
);


// 2024
printIndexPercentiles(
  composites['2024_dry'],
  '2024 Dry'
);

printIndexPercentiles(
  composites['2024_wet'],
  '2024 Wet'
);


// 2026
printIndexPercentiles(
  composites['2026_dry'],
  '2026 Dry'
);

printIndexPercentiles(
  composites['2026_wet'],
  '2026 Wet'
);


// ============================================================
// BUILT-UP MASK CHECK
// ============================================================
// Dry-season composites are used here because wet-season
// vegetation and moisture can affect NDBI values.
//
// These thresholds are only being tested for comparison.
// ============================================================

function createBuiltUpCandidates(image) {

  var ndvi = image.select('NDVI');
  var ndbi = image.select('NDBI');

  // More conservative built-up mask
  var builtA = ndbi.gt(0.10)
    .and(ndvi.lt(0.40))
    .rename('Built_A');

  // Moderate built-up mask
  var builtB = ndbi.gt(0.05)
    .and(ndvi.lt(0.40))
    .rename('Built_B');

  // Broader built-up mask
  var builtC = ndbi.gt(0.00)
    .and(ndvi.lt(0.40))
    .rename('Built_C');

  return ee.Image.cat([
    builtA,
    builtB,
    builtC
  ]);
}


// ============================================================
// CREATE BUILT-UP MASKS
// ============================================================

var builtUpCandidates = {};

builtUpCandidates['2010'] =
  createBuiltUpCandidates(composites['2010_dry']);

builtUpCandidates['2014'] =
  createBuiltUpCandidates(composites['2014_dry']);

builtUpCandidates['2018'] =
  createBuiltUpCandidates(composites['2018_dry']);

builtUpCandidates['2021'] =
  createBuiltUpCandidates(composites['2021_dry']);

builtUpCandidates['2022'] =
  createBuiltUpCandidates(composites['2022_dry']);

builtUpCandidates['2024'] =
  createBuiltUpCandidates(composites['2024_dry']);

builtUpCandidates['2026'] =
  createBuiltUpCandidates(composites['2026_dry']);


// ============================================================
// CALCULATE BUILT-UP AREA
// ============================================================

function calculateBuiltUpArea(mask, bandName, label) {

  var area = mask.select(bandName)
    .selfMask()
    .multiply(ee.Image.pixelArea())
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: studyArea,
      scale: 30,
      maxPixels: 1e13,
      bestEffort: true
    });

  var areaKm2 = ee.Number(area.get(bandName))
    .divide(1e6);

  print(
    label + ' area (km²):',
    areaKm2
  );
}


// ============================================================
// BUILT-UP AREA RESULTS
// ============================================================

// 2010
calculateBuiltUpArea(
  builtUpCandidates['2010'],
  'Built_A',
  '2010 Candidate A'
);

calculateBuiltUpArea(
  builtUpCandidates['2010'],
  'Built_B',
  '2010 Candidate B'
);

calculateBuiltUpArea(
  builtUpCandidates['2010'],
  'Built_C',
  '2010 Candidate C'
);


// 2014
calculateBuiltUpArea(
  builtUpCandidates['2014'],
  'Built_A',
  '2014 Candidate A'
);

calculateBuiltUpArea(
  builtUpCandidates['2014'],
  'Built_B',
  '2014 Candidate B'
);

calculateBuiltUpArea(
  builtUpCandidates['2014'],
  'Built_C',
  '2014 Candidate C'
);


// 2018
calculateBuiltUpArea(
  builtUpCandidates['2018'],
  'Built_A',
  '2018 Candidate A'
);

calculateBuiltUpArea(
  builtUpCandidates['2018'],
  'Built_B',
  '2018 Candidate B'
);

calculateBuiltUpArea(
  builtUpCandidates['2018'],
  'Built_C',
  '2018 Candidate C'
);


// 2021
calculateBuiltUpArea(
  builtUpCandidates['2021'],
  'Built_A',
  '2021 Candidate A'
);

calculateBuiltUpArea(
  builtUpCandidates['2021'],
  'Built_B',
  '2021 Candidate B'
);

calculateBuiltUpArea(
  builtUpCandidates['2021'],
  'Built_C',
  '2021 Candidate C'
);


// 2022
calculateBuiltUpArea(
  builtUpCandidates['2022'],
  'Built_A',
  '2022 Candidate A'
);

calculateBuiltUpArea(
  builtUpCandidates['2022'],
  'Built_B',
  '2022 Candidate B'
);

calculateBuiltUpArea(
  builtUpCandidates['2022'],
  'Built_C',
  '2022 Candidate C'
);


// 2024
calculateBuiltUpArea(
  builtUpCandidates['2024'],
  'Built_A',
  '2024 Candidate A'
);

calculateBuiltUpArea(
  builtUpCandidates['2024'],
  'Built_B',
  '2024 Candidate B'
);

calculateBuiltUpArea(
  builtUpCandidates['2024'],
  'Built_C',
  '2024 Candidate C'
);


// 2026
calculateBuiltUpArea(
  builtUpCandidates['2026'],
  'Built_A',
  '2026 Candidate A'
);

calculateBuiltUpArea(
  builtUpCandidates['2026'],
  'Built_B',
  '2026 Candidate B'
);

calculateBuiltUpArea(
  builtUpCandidates['2026'],
  'Built_C',
  '2026 Candidate C'
);


// ============================================================
// MAP THE BUILT-UP MASKS
// ============================================================

// 2026
Map.addLayer(
  builtUpCandidates['2026'].select('Built_A').selfMask(),
  {palette: ['red']},
  '2026 Built-up Candidate A (>0.10)'
);

Map.addLayer(
  builtUpCandidates['2026'].select('Built_B').selfMask(),
  {palette: ['yellow']},
  '2026 Built-up Candidate B (>0.05)',
  false
);

Map.addLayer(
  builtUpCandidates['2026'].select('Built_C').selfMask(),
  {palette: ['blue']},
  '2026 Built-up Candidate C (>0.00)',
  false
);


// 2010
Map.addLayer(
  builtUpCandidates['2010'].select('Built_A').selfMask(),
  {palette: ['red']},
  '2010 Built-up Candidate A (>0.10)',
  false
);

Map.addLayer(
  builtUpCandidates['2010'].select('Built_B').selfMask(),
  {palette: ['yellow']},
  '2010 Built-up Candidate B (>0.05)',
  false
);

Map.addLayer(
  builtUpCandidates['2010'].select('Built_C').selfMask(),
  {palette: ['blue']},
  '2010 Built-up Candidate C (>0.00)',
  false
);


// 2022
Map.addLayer(
  builtUpCandidates['2022'].select('Built_A').selfMask(),
  {palette: ['red']},
  '2022 Built-up Candidate A (>0.10)',
  false
);

Map.addLayer(
  builtUpCandidates['2022'].select('Built_B').selfMask(),
  {palette: ['yellow']},
  '2022 Built-up Candidate B (>0.05)',
  false
);

Map.addLayer(
  builtUpCandidates['2022'].select('Built_C').selfMask(),
  {palette: ['blue']},
  '2022 Built-up Candidate C (>0.00)',
  false
);
