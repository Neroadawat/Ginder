const LABELS: Record<string, string> = {
  Thai: 'อาหารไทย',
  Japanese: 'อาหารญี่ปุ่น',
  Korean: 'อาหารเกาหลี',
  Chinese: 'อาหารจีน',
  Italian: 'อาหารอิตาเลียน',
  'Fast Food': 'อาหารจานด่วน',
  Cafe: 'คาเฟ่',
  Dessert: 'ของหวาน',
  'Food Court': 'ศูนย์อาหาร',
  Steak: 'สเต๊ก',
  'Hot Pot': 'หม้อไฟ',
  Indian: 'อาหารอินเดีย',
  Other: 'อื่น ๆ',
};
export const categoryLabel = (category: string): string =>
  LABELS[category] || category;
