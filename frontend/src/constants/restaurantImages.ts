import {Image} from 'react-native';
import {RestaurantCard} from '@/types/restaurant';
import {getPlaceholderImage} from './placeholders';

// User-supplied photos for the demo venues, shared by their three branches.
const DEMO_PHOTOS: Record<string, number> = {
  'ก๋วยเตี๋ยวเรือ': require('../assets/restaurants/boat-noodles.jpg'),
  'ข้าวมันไก่': require('../assets/restaurants/chicken-rice.jpg'),
  'ส้มตำแซ่บ': require('../assets/restaurants/papaya-salad.jpg'),
  'ผัดไทยโบราณ': require('../assets/restaurants/pad-thai.jpg'),
  'ข้าวกะเพราหมูสับ': require('../assets/restaurants/basil-pork.jpg'),
  'ข้าวหน้าเนื้อ': require('../assets/restaurants/beef-rice.jpg'),
  'ราเมนต้นตำรับ': require('../assets/restaurants/ramen.jpg'),
  'ซูชิคำโต': require('../assets/restaurants/sushi.jpg'),
  'หมูกระทะเกาหลี': require('../assets/restaurants/korean-bbq.jpg'),
  'ต๊อกบกกีชีสยืด': require('../assets/restaurants/tteokbokki.jpg'),
  'ติ่มซำเช้า': require('../assets/restaurants/dim-sum.jpg'),
  'บะหมี่เป็ดย่าง': require('../assets/restaurants/duck-noodles.jpg'),
  'พิซซ่าเตาถ่าน': require('../assets/restaurants/pizza.jpg'),
  'สปาเกตตีคาโบนารา': require('../assets/restaurants/carbonara.jpg'),
  'เบอร์เกอร์เนื้อฉ่ำ': require('../assets/restaurants/burger.jpg'),
  'ไก่ทอดกรอบ': require('../assets/restaurants/fried-chicken.jpg'),
  'กาแฟดริปหอม': require('../assets/restaurants/coffee.jpg'),
  'ชานมไข่มุก': require('../assets/restaurants/bubble-tea.jpg'),
  'บิงซูสตรอว์เบอร์รี': require('../assets/restaurants/bingsu.jpg'),
  'โรตีกล้วยหอม': require('../assets/restaurants/banana-roti.jpg'),
};

export const getRestaurantImageUri = (restaurant: RestaurantCard): string => {
  const baseName = restaurant.name.replace(/ สาขา \d+$/, '');
  const localPhoto = restaurant.place_id.startsWith('synthetic:')
    ? DEMO_PHOTOS[baseName]
    : undefined;
  if (localPhoto) {
    return Image.resolveAssetSource(localPhoto).uri;
  }
  return restaurant.photo_url || getPlaceholderImage(restaurant.primary_category);
};
