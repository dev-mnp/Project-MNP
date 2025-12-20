// Mock Data Service
// Based on CSV files: District_beneficiary.csv, articles.csv, District - Master.csv

export interface District {
  id: string;
  name: string;
  code?: string;
  allottedBudget: number;
  presidentName: string;
  mobileNumber: string;
}

export interface Article {
  id: string;
  name: string;
  costPerUnit: number;
  itemType: string; // Article, Aid, Project
  category?: string;
  sequenceList?: string;
  comments?: string;
}

export interface ArticleSelection {
  articleId: string;
  articleName: string;
  quantity: number;
  costPerUnit: number;
  totalValue: number;
  comments: string;
}

export interface MasterEntryRecord {
  id: string;
  applicationNumber: string;
  beneficiaryType: 'district' | 'public' | 'institutions';
  createdAt: string;
  
  // District fields
  districtId?: string;
  districtName?: string;
  selectedArticles?: ArticleSelection[];
  totalAccrued?: number;
  
  // Public fields
  aadharNumber?: string;
  name?: string;
  handicapped?: boolean;
  address?: string;
  mobile?: string;
  articleId?: string;
  quantity?: number;
  costPerUnit?: number;
  totalValue?: number;
  comments?: string;
  
  // Institutions fields
  institutionName?: string;
  institutionType?: 'institutions' | 'others';
}

// Districts from District_beneficiary.csv
export const districts: District[] = [
  { id: '1', name: 'Andaman', allottedBudget: 10000, presidentName: 'R.Gurusamy', mobileNumber: '94742 07828' },
  { id: '2', name: 'Ariyalur', allottedBudget: 190000, presidentName: 'S.K.Ramachandran', mobileNumber: '90474 14485' },
  { id: '3', name: 'Chengalpattu', allottedBudget: 165000, presidentName: 'V.Velu', mobileNumber: '94449 64419' },
  { id: '4', name: 'Chennai Central', allottedBudget: 200000, presidentName: 'S.Rajasrigoutham', mobileNumber: '97911 09912' },
  { id: '5', name: 'Chennai North', allottedBudget: 250000, presidentName: 'M.Vedhavalli', mobileNumber: '98841 13777' },
  { id: '6', name: 'Chennai South', allottedBudget: 175000, presidentName: 'Uma Natarajan', mobileNumber: '86107 02389' },
  { id: '7', name: 'Chittoor Rural', allottedBudget: 730000, presidentName: 'T.Gangadharam', mobileNumber: '93970 50827' },
  { id: '8', name: 'Chittoor Urban', allottedBudget: 760000, presidentName: 'S.Saritha', mobileNumber: '94400 44327' },
  { id: '9', name: 'Coimbatore', allottedBudget: 430000, presidentName: 'V.Krishnamurthy', mobileNumber: '94439 37780' },
  { id: '10', name: 'Cuddalore', allottedBudget: 1350000, presidentName: 'K.Kirubanandan', mobileNumber: '9345273408' },
  { id: '11', name: 'Dharmapuri Central', code: 'DPC', allottedBudget: 340000, presidentName: 'D.K.Palaniammal', mobileNumber: '8122541128' },
  { id: '12', name: 'Dharmapuri East', code: 'DPE', allottedBudget: 100000, presidentName: 'S.Kannan', mobileNumber: '9786992063' },
  { id: '13', name: 'Dharmapuri West', code: 'DPW', allottedBudget: 225000, presidentName: 'P.Sinivasan', mobileNumber: '9488758041' },
  { id: '14', name: 'Dharmapuri North', code: 'DPN', allottedBudget: 250000, presidentName: 'A.Maadhan', mobileNumber: '9443052870' },
  { id: '15', name: 'Dharmapuri South', code: 'DPS', allottedBudget: 185000, presidentName: 'D.Jeyamurugan', mobileNumber: '9442348851' },
  { id: '16', name: 'Dindigul', allottedBudget: 700000, presidentName: 'R.Subramanian', mobileNumber: '8608077600' },
  { id: '17', name: 'Erode', allottedBudget: 400000, presidentName: 'A.Natarajan', mobileNumber: '9486840705' },
  { id: '18', name: 'Hyderabad', allottedBudget: 15000, presidentName: 'C.Kaladhar', mobileNumber: '9440422338' },
  { id: '19', name: 'Kallakurichi', allottedBudget: 1214000, presidentName: 'K.Shanmugam', mobileNumber: '9786804330' },
  { id: '20', name: 'Kanchipuram', allottedBudget: 200000, presidentName: 'D.Devendiran', mobileNumber: '9976420680' },
  { id: '21', name: 'Kanniyakumari', allottedBudget: 120000, presidentName: 'R.Selvakumar', mobileNumber: '9443694125' },
  { id: '22', name: 'Karnataka State', allottedBudget: 2000000, presidentName: 'Rajagopal', mobileNumber: '9448682626' },
  { id: '23', name: 'Karur', allottedBudget: 175000, presidentName: 'N.Jeyachandran', mobileNumber: '9443185714' },
  { id: '24', name: 'Kerala State', allottedBudget: 200000, presidentName: 'M.Sathishkumar', mobileNumber: '9443386566' },
  { id: '25', name: 'Krishnagiri North-A1', code: 'KNA1', allottedBudget: 65000, presidentName: 'J.Jeyamma', mobileNumber: '9443057483' },
  { id: '26', name: 'Krishnagiri A2', code: 'KNA2', allottedBudget: 145000, presidentName: 'R.Jaisankar', mobileNumber: '6385508169' },
  { id: '27', name: 'Krishnagiri-B1', code: 'KNB1', allottedBudget: 100000, presidentName: 'M.Raja', mobileNumber: '9442437957' },
  { id: '28', name: 'Krishnagiri-B2', code: 'KNB2', allottedBudget: 100000, presidentName: 'V.Bharathi', mobileNumber: '9488733768' },
  { id: '29', name: 'Krishnagiri-B3', code: 'KNB3', allottedBudget: 65000, presidentName: 'K.Meenatchi', mobileNumber: '9894209259' },
  { id: '30', name: 'Krishnagiri-C1', code: 'KNC1', allottedBudget: 102500, presidentName: 'B.Govindhan', mobileNumber: '9655824521' },
  { id: '31', name: 'Krishnagiri-C2', code: 'KNC2', allottedBudget: 65000, presidentName: 'T.Jegadesan', mobileNumber: '9788878958' },
  { id: '32', name: 'Krishnagiri-D', code: 'KND', allottedBudget: 79000, presidentName: 'K.S.Sundaralakshmi', mobileNumber: '8248470144' },
  { id: '33', name: 'Krishnagiri south', allottedBudget: 550000, presidentName: 'R.Jeyachandran', mobileNumber: '9500388110' },
  { id: '34', name: 'Madurai', allottedBudget: 520000, presidentName: 'P.Asokan', mobileNumber: '9842198055' },
  { id: '35', name: 'Mumbai, Navi, Pune', allottedBudget: 70000, presidentName: 'S.E.Raju, K.Gnanasekar, Vaidehi', mobileNumber: '9594432555, 9167901393, 9422526452' },
  { id: '36', name: 'Namakkal', allottedBudget: 500000, presidentName: 'S.Ganesan', mobileNumber: '9943720389' },
  { id: '38', name: 'Nellore', allottedBudget: 45000, presidentName: 'V.V.N.Padmapriya', mobileNumber: '9441490800' },
  { id: '39', name: 'Nilagiri', allottedBudget: 150000, presidentName: 'Indraninatarajan', mobileNumber: '9894791210' },
  { id: '40', name: 'Perambalur', allottedBudget: 140000, presidentName: 'K.Karuppaiah', mobileNumber: '9443952957' },
  { id: '41', name: 'Pudhucheri', allottedBudget: 200000, presidentName: 'A.Muruganandam', mobileNumber: '9843795226' },
  { id: '42', name: 'Pudhukottai', allottedBudget: 320000, presidentName: 'K.Kaliyaperumal', mobileNumber: '9443837147' },
  { id: '44', name: 'Ramanathapuram', allottedBudget: 360000, presidentName: 'P.Raju', mobileNumber: '9486561888' },
  { id: '45', name: 'Ranipet', allottedBudget: 370000, presidentName: 'R.Mani', mobileNumber: '9940974200' },
  { id: '46', name: 'Salem', allottedBudget: 600000, presidentName: 'S.Chandramohan', mobileNumber: '9443392212' },
  { id: '47', name: 'Sivagangai', allottedBudget: 170000, presidentName: 'R.Kanagasabai', mobileNumber: '9443177634' },
  { id: '48', name: 'Tenkasi', allottedBudget: 180000, presidentName: 'A.Thirumalai', mobileNumber: '9442050515' },
  { id: '49', name: 'Thane', allottedBudget: 10000, presidentName: 'S.S.Mani', mobileNumber: '9323861970' },
  { id: '50', name: 'Thanjavur', allottedBudget: 1460000, presidentName: 'B.S.Vasan', mobileNumber: '9443256395' },
  { id: '51', name: 'Theni (R.)', allottedBudget: 200000, presidentName: 'Ramachandiran', mobileNumber: '94420 24743' },
  { id: '51a', name: 'Theni(M)', allottedBudget: 100000, presidentName: 'Manokaran', mobileNumber: '9443758195' },
  { id: '52', name: 'Thirunelveli', allottedBudget: 125000, presidentName: 'S.Nagarajan', mobileNumber: '9750930575' },
  { id: '53', name: 'Thiruppur', allottedBudget: 440000, presidentName: 'Saraswathy Sadhasivam', mobileNumber: '9965584826' },
  { id: '54', name: 'Thiruvallur', allottedBudget: 950000, presidentName: 'K.Mohanasundari', mobileNumber: '9790973831' },
  { id: '55', name: 'Thiruvannamalai', allottedBudget: 850000, presidentName: 'P.Amaresan', mobileNumber: '9486711999' },
  { id: '56', name: 'Thothukudi I/C', allottedBudget: 65000, presidentName: 'S.Ganapathy Ramasubramanian', mobileNumber: '7708557476' },
  { id: '56a', name: 'Thothukudi (M)', allottedBudget: 65000, presidentName: 'Murugan', mobileNumber: '9843593407' },
  { id: '57', name: 'Tirupathur', allottedBudget: 585000, presidentName: 'A.Sadaanandhan', mobileNumber: '9443274821' },
  { id: '58', name: 'Trichy', allottedBudget: 400000, presidentName: 'Kathiravan', mobileNumber: '9842032495' },
  { id: '59', name: 'Vellore', allottedBudget: 675000, presidentName: 'K.R.Subramanian', mobileNumber: '9443222963' },
  { id: '60', name: 'Vijayawada', allottedBudget: 40000, presidentName: 'B.Sureshkumar', mobileNumber: '9440528015' },
  { id: '61', name: 'Villupuram', allottedBudget: 523000, presidentName: 'K.M.Murthy', mobileNumber: '9486169930' },
  { id: '62', name: 'Virudhunagar', allottedBudget: 400000, presidentName: 'R.Padmanaban', mobileNumber: '9442058894' },
  { id: '63', name: 'Visakapattinam', allottedBudget: 20000, presidentName: 'R.Raji', mobileNumber: '9080224192' },
  { id: '64', name: 'New Delhi-Sudhar Camp', code: 'DL-1', allottedBudget: 5000, presidentName: 'Poongkodi', mobileNumber: '9315802011' },
  { id: '65', name: 'New Delhi-Shakurpur', code: 'DL-3', allottedBudget: 0, presidentName: 'Jeyanthi', mobileNumber: '9717385224' },
  { id: '66', name: 'Madhya Pradesh-Hoshangabad', code: 'MA-1', allottedBudget: 2500, presidentName: 'Sakthi Banumathi', mobileNumber: '9479592958' },
  { id: '67', name: 'Madhya Pradesh-Bhopal', code: 'MA-2', allottedBudget: 0, presidentName: 'V.Parvathi', mobileNumber: '9669430851' },
  { id: '68', name: 'Gujarath-Sabarmathi', code: 'GJ-2', allottedBudget: 0, presidentName: 'Sekar', mobileNumber: '9664948365' },
  { id: '69', name: 'Hariyana-Panchkulla-Tamil Colony', code: 'HR-1', allottedBudget: 2000, presidentName: 'Shakti Raj', mobileNumber: '9888023575' },
  { id: '70', name: 'Melmaruvathur', allottedBudget: 604000, presidentName: 'Surendarnath', mobileNumber: '9840046263' },
  { id: '71', name: 'Additional', allottedBudget: 75000, presidentName: 'Surendarnath', mobileNumber: '9840046263' },
  { id: '72', name: 'Foreigners', allottedBudget: 5000, presidentName: 'Surendarnath', mobileNumber: '9840046263' },
];

// Articles from articles.csv
export const articles: Article[] = [
  { id: '1', name: 'AHUJA Radios', costPerUnit: 41300, itemType: 'Article', category: 'Electronics' },
  { id: '2', name: 'Accident Victim', costPerUnit: 0, itemType: 'Aid', category: '2.Aid' },
  { id: '3', name: 'Acer Monitor 21.5"', costPerUnit: 7100, itemType: 'Article', category: 'Computers & Printers' },
  { id: '4', name: 'Agri Battery Sprayer', costPerUnit: 4200, itemType: 'Article', category: 'Agriculture' },
  { id: '5', name: 'Agri Cart Weeder', costPerUnit: 74000, itemType: 'Article', category: 'Agriculture' },
  { id: '6', name: 'Agri Manual Sprayer', costPerUnit: 1568, itemType: 'Article', category: 'Agriculture' },
  { id: '7', name: 'Agri Power Sprayer (2 STK)', costPerUnit: 11760, itemType: 'Article', category: 'Agriculture' },
  { id: '8', name: 'Agri Power Sprayer (4 STK)', costPerUnit: 14000, itemType: 'Article', category: 'Agriculture' },
  { id: '9', name: 'Air Conditioner 1 Tonne', costPerUnit: 30000, itemType: 'Article', category: 'Electronics' },
  { id: '10', name: 'Al.Dabara Set 3 Kg', costPerUnit: 950, itemType: 'Article', category: 'Kitchen' },
  { id: '11', name: 'Aluminium Idli Making Box', costPerUnit: 4800, itemType: 'Article', category: 'Kitchen' },
  { id: '12', name: 'Aluminium Vessels Set - Big', costPerUnit: 5656, itemType: 'Article', category: 'Kitchen' },
  { id: '13', name: 'Aluminium Vessels Sets', costPerUnit: 0, itemType: 'Article', category: 'Kitchen' },
  { id: '14', name: 'Artificial Limb', costPerUnit: 0, itemType: 'Article', category: 'Medical' },
  { id: '15', name: 'Auto- 3 Wheeler', costPerUnit: 0, itemType: 'Article', category: 'Automotive' },
  { id: '16', name: 'Barber Set', costPerUnit: 5000, itemType: 'Article', category: 'Miscellaneous' },
  { id: '17', name: 'Bore well Pump(5 HP) / DOL Starter', costPerUnit: 55000, itemType: 'Article', category: 'Agriculture' },
  { id: '18', name: 'Bosch Electrician Kit 10 Re', costPerUnit: 4248, itemType: 'Article', category: 'Electricals' },
  { id: '19', name: 'Bosch Electrician Kit 13 Re', costPerUnit: 5428, itemType: 'Article', category: 'Electricals' },
  { id: '20', name: 'Bosch Rotary Hammer GBH 220', costPerUnit: 6372, itemType: 'Article', category: 'Electricals' },
  { id: '21', name: 'Business Aid', costPerUnit: 0, itemType: 'Aid', category: '2.Aid' },
  { id: '22', name: 'Butterfly Mixie 750W', costPerUnit: 3250, itemType: 'Article', category: 'Electronics' },
  { id: '23', name: 'COW', costPerUnit: 40000, itemType: 'Article' },
  { id: '24', name: 'Canon EOS 1500 Camera', costPerUnit: 48000, itemType: 'Article', category: 'Electronics' },
  { id: '25', name: 'Canon Printer 6030B (USB)', costPerUnit: 13900, itemType: 'Article', category: 'Computers & Printers' },
  { id: '26', name: 'Canon TR 4826 Photocopier', costPerUnit: 265000, itemType: 'Article', category: 'Computers & Printers' },
  { id: '27', name: 'Ceiling Fan', costPerUnit: 5400, itemType: 'Article', category: 'Electricals' },
  { id: '28', name: 'Ceiling Fan- Ord', costPerUnit: 1857, itemType: 'Article', category: 'Electricals' },
  { id: '29', name: 'Colour Printer HP Smart Tank 760 All in one', costPerUnit: 27500, itemType: 'Article', category: 'Computers & Printers' },
  { id: '30', name: 'Colour Toner pack', costPerUnit: 16284, itemType: 'Article', category: 'Computers & Printers' },
  { id: '31', name: 'Construction Aid', costPerUnit: 0, itemType: 'Aid', category: '2.Aid' },
  { id: '32', name: 'Desktop Computer', costPerUnit: 45500, itemType: 'Article', category: 'Computers & Printers' },
  { id: '33', name: 'Desktop Computer - HVY', costPerUnit: 119045, itemType: 'Article', category: 'Computers & Printers' },
  { id: '34', name: 'Diamond Cooker 12 Ltrs', costPerUnit: 1200, itemType: 'Article', category: 'Kitchen' },
  { id: '35', name: 'Dictionary English - Tamil', costPerUnit: 120, itemType: 'Article', category: 'Stationery' },
  { id: '36', name: 'Domestic Stove 2 Burner', costPerUnit: 2200, itemType: 'Article', category: 'Kitchen' },
  { id: '37', name: 'Education Aid', costPerUnit: 0, itemType: 'Aid', category: '2.Aid' },
  { id: '38', name: 'Electric Iron Box', costPerUnit: 1000, itemType: 'Article', category: 'Electricals' },
  { id: '39', name: 'Electronic weighing scale', costPerUnit: 7000, itemType: 'Article', category: 'Miscellaneous' },
  { id: '40', name: 'Epson Printer L3250 (Lite)', costPerUnit: 15800, itemType: 'Article', category: 'Computers & Printers' },
  { id: '41', name: 'Ex gratia for Deceased', costPerUnit: 0, itemType: 'Aid', category: '2.Aid' },
  { id: '42', name: 'Financial Aid', costPerUnit: 0, itemType: 'Aid', category: '2.Aid' },
  { id: '43', name: 'Fishing net', costPerUnit: 50000, itemType: 'Article', category: 'Miscellaneous' },
  { id: '44', name: 'Fixed Wheel Chair', costPerUnit: 4410, itemType: 'Article', category: 'Bicycle & Tricycle' },
  { id: '45', name: 'Flood Light 50 W', costPerUnit: 500, itemType: 'Article', category: 'Electricals' },
  { id: '46', name: 'Flood Relief Fund', costPerUnit: 0, itemType: 'Aid', category: '2.Aid' },
  { id: '47', name: 'Foldable Wheel Chair', costPerUnit: 5775, itemType: 'Article', category: 'Bicycle & Tricycle' },
  { id: '48', name: 'Front Load Business Tricycle', costPerUnit: 14560, itemType: 'Article', category: 'Bicycle & Tricycle' },
  { id: '49', name: 'Fruit Juice Mixie', costPerUnit: 5850, itemType: 'Article', category: 'Electricals' },
  { id: '50', name: 'Gaja Hi tech Agro 6.5 HP Pump', costPerUnit: 14000, itemType: 'Article', category: 'Agriculture' },
  { id: '51', name: 'Gaja Mini Weeder', costPerUnit: 24000, itemType: 'Article', category: 'Agriculture' },
  { id: '52', name: 'Gasoline Generator XLNT-9500E', costPerUnit: 75000, itemType: 'Article', category: 'Agriculture' },
  { id: '53', name: 'Gents Cycle', costPerUnit: 5500, itemType: 'Article', category: 'Bicycle & Tricycle' },
  { id: '54', name: 'Girls Cycle', costPerUnit: 5200, itemType: 'Article', category: 'Bicycle & Tricycle' },
  { id: '55', name: 'Goat', costPerUnit: 10000, itemType: 'Article', category: 'Livestock' },
  { id: '56', name: 'Gp Welding Machine Arc 200', costPerUnit: 6726, itemType: 'Article', category: 'Electricals' },
  { id: '57', name: 'Grass Cutter Machine', costPerUnit: 34515, itemType: 'Article', category: 'Agriculture' },
  { id: '58', name: 'Gravy Grinder 3 Ltr', costPerUnit: 30000, itemType: 'Article', category: 'Grinders' },
  { id: '59', name: 'Groceries', costPerUnit: 3000, itemType: 'Aid', category: '2.Aid' },
  { id: '60', name: 'HP Printer 1108 Plus', costPerUnit: 15700, itemType: 'Article', category: 'Computers & Printers' },
  { id: '61', name: 'HP Printer 126NW (Heavy, All in 1)', costPerUnit: 23700, itemType: 'Article', category: 'Computers & Printers' },
  { id: '62', name: 'Hand Sewing Machine with Motor', costPerUnit: 5916, itemType: 'Article', category: 'Sewing Machines' },
  { id: '63', name: 'Handicapped Hand Tricycle', costPerUnit: 7350, itemType: 'Article', category: 'Bicycle & Tricycle' },
  { id: '64', name: 'Handicapped Scooter', costPerUnit: 0, itemType: 'Article', category: 'Automotive' },
  { id: '65', name: 'Hearing Aid', costPerUnit: 18000, itemType: 'Article', category: 'Medical' },
  { id: '66', name: 'Instant Grinder 30 Kgs', costPerUnit: 22892, itemType: 'Article', category: 'Grinders' },
  { id: '67', name: 'Inverter', costPerUnit: 19900, itemType: 'Article', category: 'Electricals' },
  { id: '68', name: 'Iron Box', costPerUnit: 6600, itemType: 'Article', category: 'Electronics' },
  { id: '69', name: 'Iron Ms Stove 2 Burner', costPerUnit: 2400, itemType: 'Article', category: 'Kitchen' },
  { id: '70', name: 'Junior Cycle', costPerUnit: 5000, itemType: 'Article', category: 'Bicycle & Tricycle' },
  { id: '71', name: 'Kissan Power Weeder', costPerUnit: 55000, itemType: 'Article', category: 'Agriculture' },
  { id: '72', name: 'Laptop', costPerUnit: 34000, itemType: 'Article', category: 'Computers & Printers' },
  { id: '73', name: 'Laptop (3511)', costPerUnit: 47500, itemType: 'Article', category: 'Computers & Printers' },
  { id: '74', name: 'Laptop (Victus)', costPerUnit: 79000, itemType: 'Article', category: 'Computers & Printers' },
  { id: '75', name: 'Laptop - i5', costPerUnit: 60800, itemType: 'Article', category: 'Computers & Printers' },
  { id: '76', name: 'Laptop - i5(Lite)', costPerUnit: 53000, itemType: 'Article', category: 'Computers & Printers' },
  { id: '77', name: 'Lenova Tab', costPerUnit: 13000, itemType: 'Article', category: 'Computers & Printers' },
  { id: '78', name: 'Livelihood Aid', costPerUnit: 0, itemType: 'Aid', category: '2.Aid' },
  { id: '79', name: 'Medical Aid', costPerUnit: 0, itemType: 'Aid', category: '2.Aid' },
  { id: '80', name: 'Mini freezer', costPerUnit: 17000, itemType: 'Article', category: 'Electronics' },
  { id: '81', name: 'Office Table 4X2', costPerUnit: 4602, itemType: 'Article', category: 'Office Supplies' },
  { id: '82', name: 'Orient 20 W Bulb', costPerUnit: 130, itemType: 'Article', category: 'Electricals' },
  { id: '83', name: 'Oxygen Concentrator', costPerUnit: 71680, itemType: 'Article', category: 'Medical' },
  { id: '84', name: 'Paper Plate Making Machine', costPerUnit: 218300, itemType: 'Article', category: 'Miscellaneous' },
  { id: '85', name: 'Podiam Mike- Digimore', costPerUnit: 1900, itemType: 'Article', category: 'Electronics' },
  { id: '86', name: 'Portable Speaker', costPerUnit: 12000, itemType: 'Article', category: 'Electronics' },
  { id: '87', name: 'Preethi Mixie', costPerUnit: 7000, itemType: 'Article', category: 'Electronics' },
  { id: '88', name: 'Prestige Mixer Grinder 1000 W', costPerUnit: 2900, itemType: 'Article', category: 'Electronics' },
  { id: '89', name: 'Project', costPerUnit: 0, itemType: 'Project', category: '1.Project' },
  { id: '90', name: 'Provision materials to Orphanages', costPerUnit: 0, itemType: 'Article', category: 'Miscellaneous' },
  { id: '91', name: 'Push Cart With Top', costPerUnit: 15000, itemType: 'Article', category: 'Bicycle & Tricycle' },
  { id: '92', name: 'Push Cart With Top/Iron Box', costPerUnit: 21600, itemType: 'Article', category: 'Bicycle & Tricycle/Electronics' },
  { id: '93', name: 'Push Cart Without Top', costPerUnit: 13000, itemType: 'Article', category: 'Bicycle & Tricycle' },
  { id: '94', name: 'Pushcart + Idli box + MS Burner stove', costPerUnit: 21400, itemType: 'Article', category: 'Bicycle & Tricycle/Kitchen' },
  { id: '95', name: 'RO water Purifier 10 Ltrs', costPerUnit: 15000, itemType: 'Article', category: 'Kitchen' },
  { id: '96', name: 'Renovation Aid', costPerUnit: 0, itemType: 'Aid', category: '2.Aid' },
  { id: '97', name: 'Rice 1000 Kgs', costPerUnit: 60000, itemType: 'Article', category: 'Miscellaneous' },
  { id: '98', name: 'S Type Chair', costPerUnit: 2242, itemType: 'Article', category: 'Office Supplies' },
  { id: '99', name: 'Sandalwood tree Sapling', costPerUnit: 66, itemType: 'Article', category: 'Agriculture' },
  { id: '100', name: 'School Furniture', costPerUnit: 53400, itemType: 'Article', category: 'Office Supplies' },
  { id: '101', name: 'Sewing Machine Heavy', costPerUnit: 11923, itemType: 'Article', category: 'Sewing Machines' },
  { id: '102', name: 'Sewing Machine ORD', costPerUnit: 5200, itemType: 'Article', category: 'Sewing Machines' },
  { id: '103', name: 'Sewing Machine ORD / Motor', costPerUnit: 6300, itemType: 'Article', category: 'Sewing Machines' },
  { id: '104', name: 'Sewing Machine Overlock', costPerUnit: 7500, itemType: 'Article', category: 'Sewing Machines' },
  { id: '105', name: 'Sewing Machine Universal ZigZag', costPerUnit: 12300, itemType: 'Article', category: 'Sewing Machines' },
  { id: '106', name: 'Single Burner Stove', costPerUnit: 2100, itemType: 'Article', category: 'Kitchen' },
  { id: '107', name: 'Steel Cupboard', costPerUnit: 12390, itemType: 'Article', category: 'Office Supplies' },
  { id: '108', name: 'Surya Gas Stove', costPerUnit: 3800, itemType: 'Article', category: 'Kitchen' },
  { id: '109', name: 'TIFFEN SET + MS STOVE 2 BURNER', costPerUnit: 6600, itemType: 'Article', category: 'Kitchen' },
  { id: '110', name: 'Table Top Tilting Grinder 2 Ltr', costPerUnit: 7788, itemType: 'Article', category: 'Grinders' },
  { id: '111', name: 'Table Top Wet Grinder 2 Ltr', costPerUnit: 3304, itemType: 'Article', category: 'Grinders' },
  { id: '112', name: 'Table Top Wet Grinder 3Ltr', costPerUnit: 9500, itemType: 'Article', category: 'Grinders' },
  { id: '113', name: 'Table fan', costPerUnit: 1300, itemType: 'Article', category: 'Electricals' },
  { id: '114', name: 'Tea & Milk Steamer', costPerUnit: 12500, itemType: 'Article', category: 'Kitchen' },
  { id: '115', name: 'Tea can 10 ltrs', costPerUnit: 1500, itemType: 'Article', category: 'Kitchen' },
  { id: '116', name: 'Tiffen Set', costPerUnit: 4000, itemType: 'Article', category: 'Kitchen' },
  { id: '117', name: 'Tiffen Set + Idli Box +2 burner stove', costPerUnit: 11200, itemType: 'Article', category: 'Kitchen' },
  { id: '118', name: 'Titan Agri Chain Saw', costPerUnit: 12000, itemType: 'Article', category: 'Agriculture' },
  { id: '119', name: 'Tree plant Saplings', costPerUnit: 10, itemType: 'Article', category: 'Agriculture' },
  { id: '120', name: 'Two Wheeler', costPerUnit: 0, itemType: 'Article', category: 'Automotive' },
  { id: '121', name: 'Water Hose -Braided', costPerUnit: 1600, itemType: 'Article', category: 'Agriculture' },
  { id: '122', name: 'Weighing Scale+ Bicycle+Basket for Fish Vendor', costPerUnit: 20000, itemType: 'Article', category: 'Bicycle & Tricycle' },
  { id: '123', name: 'Wet Grinder 2 Ltr (Hgt)', costPerUnit: 8496, itemType: 'Article', category: 'Grinders' },
  { id: '124', name: 'Wet Grinder 3 Ltrs', costPerUnit: 15930, itemType: 'Article', category: 'Grinders' },
  { id: '125', name: 'Wet Grinder 5 Ltrs', costPerUnit: 19116, itemType: 'Article', category: 'Grinders' },
  { id: '126', name: 'Wet Grinder Floor Model 2 Ltr', costPerUnit: 6726, itemType: 'Article', category: 'Grinders' },
  { id: '127', name: 'Wood Saw Machine (P)', costPerUnit: 9300, itemType: 'Article', category: 'Agriculture' },
  { id: '128', name: 'kk.bc.8635.Brush Cutter', costPerUnit: 14000, itemType: 'Article', category: 'Agriculture' },
];

// Institution types
export const institutionTypes = ['institutions', 'others'] as const;

// Sample records for table view (based on District - Master.csv structure)
let sampleRecords: MasterEntryRecord[] = [
  {
    id: '1',
    applicationNumber: 'D 001',
    beneficiaryType: 'district',
    districtId: '2',
    districtName: 'Ariyalur',
    selectedArticles: [
      { articleId: '4', articleName: 'Agri Battery Sprayer', quantity: 11, costPerUnit: 4200, totalValue: 46200, comments: 'No' },
      { articleId: '32', articleName: 'Desktop Computer', quantity: 1, costPerUnit: 45500, totalValue: 45500, comments: 'No' },
      { articleId: '60', articleName: 'HP Printer 1108 Plus', quantity: 1, costPerUnit: 15700, totalValue: 15700, comments: 'No' },
      { articleId: '102', articleName: 'Sewing Machine ORD', quantity: 16, costPerUnit: 5200, totalValue: 83200, comments: 'No' },
    ],
    totalAccrued: 190600,
    createdAt: '2024-01-15T10:30:00Z',
  },
  {
    id: '2',
    applicationNumber: 'D 002',
    beneficiaryType: 'district',
    districtId: '3',
    districtName: 'Chengalpattu',
    selectedArticles: [
      { articleId: '7', articleName: 'Agri Power Sprayer (2 STK)', quantity: 2, costPerUnit: 11760, totalValue: 23520, comments: 'No' },
      { articleId: '53', articleName: 'Gents Cycle', quantity: 8, costPerUnit: 5500, totalValue: 44000, comments: 'No' },
      { articleId: '54', articleName: 'Girls Cycle', quantity: 8, costPerUnit: 5200, totalValue: 41600, comments: 'No' },
      { articleId: '68', articleName: 'Iron Box', quantity: 8, costPerUnit: 6600, totalValue: 52800, comments: 'No' },
      { articleId: '102', articleName: 'Sewing Machine ORD', quantity: 6, costPerUnit: 5200, totalValue: 31200, comments: 'No' },
    ],
    totalAccrued: 193120,
    createdAt: '2024-01-16T14:20:00Z',
  },
  {
    id: '3',
    applicationNumber: 'P 001',
    beneficiaryType: 'public',
    aadharNumber: '1234567890123456',
    name: 'Rajesh Kumar',
    handicapped: false,
    address: '123 Main Street, Chennai',
    mobile: '9876543210',
    articleId: '72',
    quantity: 1,
    costPerUnit: 34000,
    totalValue: 34000,
    comments: 'For education purpose',
    createdAt: '2024-01-17T09:15:00Z',
  },
  {
    id: '4',
    applicationNumber: 'P 002',
    beneficiaryType: 'public',
    aadharNumber: '2345678901234567',
    name: 'Priya Devi',
    handicapped: true,
    address: '456 Park Avenue, Madurai',
    mobile: '9876543211',
    articleId: '102',
    quantity: 1,
    costPerUnit: 5200,
    totalValue: 5200,
    comments: 'For livelihood',
    createdAt: '2024-01-18T11:45:00Z',
  },
  {
    id: '5',
    applicationNumber: 'I 001',
    beneficiaryType: 'institutions',
    institutionName: 'ABC Orphanage',
    institutionType: 'institutions',
    address: '789 Orphanage Road, Coimbatore',
    mobile: '9876543212',
    selectedArticles: [
      { articleId: '34', articleName: 'Diamond Cooker 12 Ltrs', quantity: 10, costPerUnit: 1200, totalValue: 12000, comments: 'For kitchen' },
      { articleId: '111', articleName: 'Table Top Wet Grinder 2 Ltr', quantity: 5, costPerUnit: 3304, totalValue: 16520, comments: 'For kitchen' },
    ],
    totalAccrued: 28520,
    createdAt: '2024-01-19T13:30:00Z',
  },
];

// Helper functions
export const getDistrictById = (id: string): District | undefined => {
  return districts.find(d => d.id === id);
};

export const getDistrictByName = (name: string): District | undefined => {
  return districts.find(d => d.name === name);
};

export const getArticleById = (id: string): Article | undefined => {
  return articles.find(a => a.id === id);
};

export const getArticleByName = (name: string): Article | undefined => {
  return articles.find(a => a.name === name);
};

export const getAllRecords = (): MasterEntryRecord[] => {
  return sampleRecords;
};

export const getRecordsByBeneficiaryType = (type: 'district' | 'public' | 'institutions'): MasterEntryRecord[] => {
  return sampleRecords.filter(r => r.beneficiaryType === type);
};

export const getRecordById = (id: string): MasterEntryRecord | undefined => {
  return sampleRecords.find(r => r.id === id);
};

export const getRecordByApplicationNumber = (appNumber: string): MasterEntryRecord | undefined => {
  return sampleRecords.find(r => r.applicationNumber === appNumber);
};

export const addRecord = (record: MasterEntryRecord): void => {
  sampleRecords.push(record);
};

export const updateRecord = (id: string, record: Partial<MasterEntryRecord>): void => {
  const index = sampleRecords.findIndex(r => r.id === id);
  if (index !== -1) {
    sampleRecords[index] = { ...sampleRecords[index], ...record };
  }
};

export const deleteRecord = (id: string): void => {
  sampleRecords = sampleRecords.filter(r => r.id !== id);
};

// Calculate remaining fund for a district
export const calculateRemainingFund = (districtId: string): number => {
  const district = getDistrictById(districtId);
  if (!district) return 0;
  
  const districtRecords = sampleRecords.filter(
    r => r.beneficiaryType === 'district' && r.districtId === districtId
  );
  
  const totalUsed = districtRecords.reduce((sum, record) => {
    return sum + (record.totalAccrued || 0);
  }, 0);
  
  return district.allottedBudget - totalUsed;
};
