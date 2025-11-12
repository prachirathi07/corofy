export interface Product {
  id: string;
  industry: string;
  brandName: string;
  chemicalName: string;
  application: string;
  targetCountries: string[];
}

export const productData: Product[] = [
  // Agrochemical Products
  {
    id: "1",
    industry: "Agrochemical",
    brandName: "CORSA",
    chemicalName: "Calcium Alkylbenzene Sulfonate / CaDDBS",
    application: "Anionic Surfactant / Emulsifier for EC Formulation",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },
  {
    id: "2",
    industry: "Agrochemical",
    brandName: "MAPOL NP",
    chemicalName: "Nonylphenol Ethoxylate",
    application: "Nonionic Surfactant / Emulsifier for EC Formulation",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },
  {
    id: "3",
    industry: "Agrochemical",
    brandName: "MAPOL CO",
    chemicalName: "Castor Oil Ethoxylate",
    application: "Nonionic Surfactant / Emulsifier for EC Formulation",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },
  {
    id: "4",
    industry: "Agrochemical",
    brandName: "MAPOL SP",
    chemicalName: "Styrenated Phenol Ethoxylate / Tristyrylphenol Ethoxylate",
    application: "Nonionic Surfactant / Emulsifier for EC Formulation",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },
  {
    id: "5",
    industry: "Agrochemical",
    brandName: "COPOL",
    chemicalName: "Blended Emulsifier Pair for EC",
    application: "Anionic and Nonionic Emulsifier Pair for EC Formulation",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },
  {
    id: "6",
    industry: "Agrochemical",
    brandName: "COROSIL",
    chemicalName: "Precipitated Silica",
    application: "Dispersant / Anticaking for WP Formulation",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },
  {
    id: "7",
    industry: "Agrochemical",
    brandName: "MAPOL MQ1791",
    chemicalName: "Dispersing Agent for SC",
    application: "Dispersing Agent for SC Formulation",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },
  {
    id: "8",
    industry: "Agrochemical",
    brandName: "MAPOL LQ43",
    chemicalName: "Dispersing Agent for SC",
    application: "Versatile Dispersing Agent for SC Formulation",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },
  {
    id: "9",
    industry: "Agrochemical",
    brandName: "MAPOL LQ44",
    chemicalName: "Wetting Agent for SC",
    application: "Versatile Wetting Agent for SC Formulation",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },
  {
    id: "10",
    industry: "Agrochemical",
    brandName: "COMOL DN",
    chemicalName: "Dispersing Agent for WP & WDG",
    application: "Dispersing Agent for WP & WDG Formulation",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },
  {
    id: "11",
    industry: "Agrochemical",
    brandName: "COMOL SF",
    chemicalName: "Wetting Agent for WP & WDG",
    application: "Dispersing Agent for WP & WDG Formulation",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },
  {
    id: "12",
    industry: "Agrochemical",
    brandName: "COROFOAM",
    chemicalName: "Silicone Based Antifoam or Defoamer",
    application: "Silicone Based Defoamer",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },
  {
    id: "13",
    industry: "Agrochemical",
    brandName: "LEAFWET 408",
    chemicalName: "Strong Adjuvant",
    application: "Intank and Tank Mix Adjuvant for coverage, efficacy and rain fasting",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },
  {
    id: "14",
    industry: "Agrochemical",
    brandName: "Sulfur 80WDG",
    chemicalName: "Sulfur Wettable Dry Granules",
    application: "Fertilizer and Herbicide",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },
  {
    id: "15",
    industry: "Agrochemical",
    brandName: "Micronutrients",
    chemicalName: "Chelated Metals",
    application: "Micronutrient as Fertilizer",
    targetCountries: ["Australia", "USA", "Indonesia", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana", "Turkey", "Georgia", "Uzbekistan", "Kazakhstan", "Azerbaijan", "Nigeria", "South Africa", "Ethiopia", "Egypt"]
  },

  // Lubricant Products
  {
    id: "16",
    industry: "Lubricant",
    brandName: "MEG",
    chemicalName: "Monoethylene Glycol",
    application: "Coolant Formulation main component",
    targetCountries: ["UAE", "Australia", "Tanzania", "Kenya", "Uganda", "South Africa", "Ethiopia", "Nigeria", "Iraq", "India"]
  },
  {
    id: "17",
    industry: "Lubricant",
    brandName: "DEG",
    chemicalName: "Diethylene Glycol",
    application: "Break Fluid Main Component",
    targetCountries: ["UAE", "Australia", "Tanzania", "Kenya", "Uganda", "South Africa", "Ethiopia", "Nigeria", "Iraq", "India"]
  },
  {
    id: "18",
    industry: "Lubricant",
    brandName: "COROBLUE",
    chemicalName: "Urea Solution / Diesel Exhaust Fluid",
    application: "Diesel Exhaust Fluid",
    targetCountries: ["UAE", "Australia", "Tanzania", "Kenya", "Uganda", "South Africa", "Ethiopia", "Nigeria", "Iraq"]
  },
  {
    id: "19",
    industry: "Lubricant",
    brandName: "COROLUBE TBN400 Ca",
    chemicalName: "Total Base Number Improver Calcium based",
    application: "Total Base Number Improver",
    targetCountries: ["UAE", "Australia", "Tanzania", "Kenya", "Uganda", "South Africa", "Ethiopia", "Nigeria", "Iraq", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana"]
  },
  {
    id: "20",
    industry: "Lubricant",
    brandName: "COROLUBE ZDDP",
    chemicalName: "Zinc Booster",
    application: "Zinc Booster",
    targetCountries: ["UAE", "Australia", "Tanzania", "Kenya", "Uganda", "South Africa", "Ethiopia", "Nigeria", "Iraq", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana"]
  },
  {
    id: "21",
    industry: "Lubricant",
    brandName: "COROLUBE PIBSI",
    chemicalName: "Polyisobutylene Succinimide / PIBSI",
    application: "Dispersant for Lubricant",
    targetCountries: ["UAE", "Australia", "Tanzania", "Kenya", "Uganda", "South Africa", "Ethiopia", "Nigeria", "Iraq", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana"]
  },
  {
    id: "22",
    industry: "Lubricant",
    brandName: "COROLUBE",
    chemicalName: "Additive Packages for Petro and Diesel Engine",
    application: "Additive Packages for Petro and Diesel Engine",
    targetCountries: ["UAE", "Australia", "Tanzania", "Kenya", "Uganda", "South Africa", "Ethiopia", "Nigeria", "Iraq", "Brazil", "Argentina", "Colombia", "Mexico", "Peru", "Uruguay", "Paraguay", "Bolivia", "Guyana"]
  },

  // Oil & Gas Products
  {
    id: "23",
    industry: "Oil & Gas",
    brandName: "CORODRILL MG",
    chemicalName: "Cloud Point Glycol for Drilling",
    application: "Cloud Point Glycol for Drilling",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "24",
    industry: "Oil & Gas",
    brandName: "CORODRILL SG",
    chemicalName: "Nonionic Polyalkylimide Glycol Blend",
    application: "Shale Inhibitor",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "25",
    industry: "Oil & Gas",
    brandName: "COROFOAM AE5",
    chemicalName: "nonionic foaming agent",
    application: "Foaming Agent in Acid Stimulation",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "26",
    industry: "Oil & Gas",
    brandName: "COROMUL DD6",
    chemicalName: "Drilling Detergent",
    application: "Drilling Detergent",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "27",
    industry: "Oil & Gas",
    brandName: "MEG",
    chemicalName: "Monoethylene Glycol",
    application: "Corrosion Inhibitor and Hydration Inhibitor",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "28",
    industry: "Oil & Gas",
    brandName: "TEG",
    chemicalName: "Triethylene Glycol",
    application: "Natural Gay Dehydration",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "29",
    industry: "Oil & Gas",
    brandName: "COROL PAC",
    chemicalName: "PAC - Polyanionic Cellulose",
    application: "Fluid Loss Control Agent",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "30",
    industry: "Oil & Gas",
    brandName: "COROL CMC",
    chemicalName: "Carboxymethyl Cellulose",
    application: "Viscosifier",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "31",
    industry: "Oil & Gas",
    brandName: "COROL XC",
    chemicalName: "XC Polymer Xanthan Gum based",
    application: "Viscosifier",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "32",
    industry: "Oil & Gas",
    brandName: "MEA",
    chemicalName: "Mono Ethanol Amine",
    application: "Gas Sweetening",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "33",
    industry: "Oil & Gas",
    brandName: "COROTEX SA",
    chemicalName: "Sulfonated Asphalt",
    application: "Filtration Control",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "34",
    industry: "Oil & Gas",
    brandName: "COROL CaBr",
    chemicalName: "Calcium Bromide Liquid 52%",
    application: "Completion Fluid",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "35",
    industry: "Oil & Gas",
    brandName: "COROMUL",
    chemicalName: "Primary & Secondary Emulsifier",
    application: "Emulsifier for Drilling",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "36",
    industry: "Oil & Gas",
    brandName: "COROL CI",
    chemicalName: "Corrosion Inhibitor Imidazoline Based",
    application: "Corrosion Inhibitor",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "37",
    industry: "Oil & Gas",
    brandName: "Demulsifier",
    chemicalName: "Demulsifier Concentrate",
    application: "Demulsifier Concentrate",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "38",
    industry: "Oil & Gas",
    brandName: "COROL PPD",
    chemicalName: "Pour Point Depressant",
    application: "Pour Point Depressant",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "39",
    industry: "Oil & Gas",
    brandName: "CORO ANIFOAM",
    chemicalName: "Defoamers- Glycol, Silicone and Ethoxylate based",
    application: "Defoamer",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "40",
    industry: "Oil & Gas",
    brandName: "COROTEC D-1",
    chemicalName: "Organophilic Clay",
    application: "Rheology Modifier",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "41",
    industry: "Oil & Gas",
    brandName: "NMA - N Methyl Aniline",
    chemicalName: "N Methyl Aniline",
    application: "Octane Booster / Fuel Blending",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico", "Pakistan"]
  },
  {
    id: "42",
    industry: "Oil & Gas",
    brandName: "COROL FSII",
    chemicalName: "Methyl Diethylene Glycol",
    application: "Fuel System Icing Inhibitor",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico"]
  },
  {
    id: "43",
    industry: "Oil & Gas",
    brandName: "COROL OBS 01",
    chemicalName: "Mud Thinner",
    application: "Oil Based Mud Thinner",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico"]
  },
  {
    id: "44",
    industry: "Oil & Gas",
    brandName: "COROL WTO",
    chemicalName: "Mud Wetting Agent",
    application: "Oil Based Mud Wetting Agent",
    targetCountries: ["UAE", "USA", "Australia", "Iraq", "Oman", "Kuwait", "Saudi Arabia", "Egypt", "Azerbaijan", "Kazakhstan", "Vietnam", "Malaysia", "Indonesia", "Nigeria", "Angola", "Algeria", "Libya", "Bolivia", "Guyana", "Mexico"]
  }
];

export const getIndustries = (): string[] => {
  return Array.from(new Set(productData.map(product => product.industry)));
};

export const getBrandsByIndustry = (industry: string): string[] => {
  return Array.from(new Set(
    productData
      .filter(product => product.industry === industry)
      .map(product => product.brandName)
  ));
};

export const getChemicalsByBrand = (industry: string, brandName: string): string[] => {
  return Array.from(new Set(
    productData
      .filter(product => product.industry === industry && product.brandName === brandName)
      .map(product => product.chemicalName)
  ));
};

export const getCountriesBySelection = (industry: string, brandName: string, chemicalName: string): string[] => {
  const product = productData.find(
    p => p.industry === industry && p.brandName === brandName && p.chemicalName === chemicalName
  );
  return product ? product.targetCountries : [];
};

export const getProductBySelection = (industry: string, brandName: string, chemicalName: string): Product | undefined => {
  return productData.find(
    p => p.industry === industry && p.brandName === brandName && p.chemicalName === chemicalName
  );
};