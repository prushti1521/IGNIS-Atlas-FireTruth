import type { RegionDefinition } from '../types/fire';

export const STUDY_REGIONS: RegionDefinition[] = [
  {
    id: 'california',
    name: 'California, USA',
    stateCountry: 'United States',
    bounds: [[32.5, -124.4], [42.0, -114.1]],
    center: [37.25, -119.75],
    zoom: 6,
    fireRegime: 'Temperate Wildfire (Forest & Chaparral)',
    primaryPeakMonths: [7, 8, 9, 10], // July - October
    baselineAlphaRatio: 3.68, // VIIRS cell-days to MODIS cell-days empirical ratio
    description: 'Mediterranean climate characterized by hot, dry summers, seasonal Santa Ana / Diablo foehn winds, and expansive timber/chaparral fuels.',
    scientificContext: 'Primary benchmark region. Demonstrates the critical difference between raw hotspot counts (which surge ~3.7x in 2012 due to VIIRS 375m I-band resolution) and true burned area. Captures historic events: 2003 Cedar, 2008 Lightning Siege, 2017 Tubbs, 2018 Camp/Mendocino, 2020 August Complex (1,032,648-acre megafire; part of California\'s record 4.3M-acre 2020 fire siege), and 2021 Dixie Fire (963k acres).',
    knownMegaFireYears: [2003, 2007, 2008, 2017, 2018, 2020, 2021]
  },
  {
    id: 'punjab',
    name: 'Punjab & Haryana, India',
    stateCountry: 'India',
    bounds: [[28.4, 73.8], [32.5, 77.6]],
    center: [30.7, 75.8],
    zoom: 7,
    fireRegime: 'Agricultural Residue Burning (Post-harvest)',
    primaryPeakMonths: [10, 11], // October - November (Kharif paddy stubble burning)
    baselineAlphaRatio: 5.84, // Much higher scaling factor due to small agricultural fires!
    description: 'Intense agricultural crop residue burning following mechanized rice harvest prior to winter wheat sowing in the Indo-Gangetic Plains.',
    scientificContext: 'Crucial contrast regime! Proves that a single global calibration ratio (e.g. 3.7x from California) completely fails in agricultural zones. Paddy stubble burns are small (<50m²), short-lived, and low-temperature. MODIS (1km) misses ~80% of them due to sub-pixel thermal dilution, whereas VIIRS (375m) detects up to 6x more cell-days.',
    knownMegaFireYears: [2016, 2018, 2020, 2021]
  },
  {
    id: 'amazon',
    name: 'Amazon Basin & Pantanal, Brazil',
    stateCountry: 'Brazil',
    bounds: [[-18.0, -65.0], [-2.0, -48.0]],
    center: [-10.5, -56.5],
    zoom: 5,
    fireRegime: 'Tropical Deforestation & Peat Smoldering',
    primaryPeakMonths: [8, 9, 10], // August - October dry season
    baselineAlphaRatio: 4.15,
    description: 'Tropical rainforest deforestation frontiers and the Pantanal wetland savanna. Characterized by severe drought-amplified fires and persistent understory burning.',
    scientificContext: 'Key test of the Observation Completeness Gate. During the wet season (December–April), cloud cover exceeds 75–85%, creating severe satellite detection voids. In the dry season, heavy smoke plumes attenuate thermal signals. Highlights the 2019 Amazon deforestation surge and 2020/2024 Pantanal ecological crises.',
    knownMegaFireYears: [2005, 2010, 2019, 2020, 2024]
  },
  {
    id: 'australia',
    name: 'SE Australia (NSW & Victoria)',
    stateCountry: 'Australia',
    bounds: [[-38.5, 145.0], [-28.5, 154.0]],
    center: [-34.0, 150.0],
    zoom: 6,
    fireRegime: 'Subtropical Bushfire & Pyrocumulonimbus',
    primaryPeakMonths: [12, 1, 2], // December - February (Austral summer)
    baselineAlphaRatio: 3.42,
    description: 'Eucalyptus forest and temperate woodlands susceptible to extreme positive Indian Ocean Dipole and Southern Annular Mode droughts.',
    scientificContext: 'Features the catastrophic 2019–2020 "Black Summer" fires that consumed over 24 million hectares. Massive pyro-convective smoke columns reached 35 km into the stratosphere, causing severe channel saturation in satellite thermal detectors.',
    knownMegaFireYears: [2003, 2009, 2019, 2020]
  }
];

export const DEFAULT_REGION = STUDY_REGIONS[0]; // California
