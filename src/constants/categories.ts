export const VENDOR_CATEGORIES = [
  'Tiffin Centers',
  'Restaurants and Fast Food',
  'Grocery Stores',
  'Meat and Poultry Stores',
  'Pooja Item Stores',
  'Bakery and Snack Stores',
  'Vegetable and Fruit Markets'
] as const;

export type VendorCategory = typeof VENDOR_CATEGORIES[number];

