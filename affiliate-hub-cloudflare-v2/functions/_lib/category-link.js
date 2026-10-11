// Existing short links remain valid; new links always use the category's own name.
const oldLinks=new Map([
  ['keycap','KEYCAP'],['sports','กีฬา'],['beauty','ความงาม'],
  ['home-kitchen','บ้านและครัว'],['electronics','อิเล็กทรอนิกส์'],['fashion','แฟชั่น'],
]);

export const categorySlug=category=>String(category).normalize('NFC');
export const oldCategoryName=slug=>oldLinks.get(slug);
export function oldGeneratedSlug(category){
  let hash=14695981039346656037n;
  for(const byte of new TextEncoder().encode(categorySlug(category)))hash=((hash^BigInt(byte))*1099511628211n)&0xffffffffffffffffn;
  return 'c-'+hash.toString(36);
}
