const knownSlugs=new Map([
  ['KEYCAP','keycap'],
  ['กีฬา','sports'],
  ['ความงาม','beauty'],
  ['บ้านและครัว','home-kitchen'],
  ['อิเล็กทรอนิกส์','electronics'],
  ['แฟชั่น','fashion'],
]);

export function categorySlug(category){
  const name=String(category).normalize('NFC');
  if(knownSlugs.has(name))return knownSlugs.get(name);
  let hash=14695981039346656037n;
  for(const byte of new TextEncoder().encode(name))hash=((hash^BigInt(byte))*1099511628211n)&0xffffffffffffffffn;
  return 'c-'+hash.toString(36);
}
