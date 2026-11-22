/** Opciones fijas al inicio de cada lista de razas. */
export const RAZAS_COMUNES = ["Mestizo", "No lo sé"];

export const RAZAS_PERRO = [
  ...RAZAS_COMUNES,
  "Akita",
  "Beagle",
  "Bichón Frisé",
  "Border Collie",
  "Boxer",
  "Bulldog Francés",
  "Bulldog Inglés",
  "Caniche / Poodle",
  "Chihuahua",
  "Cocker Spaniel",
  "Collie",
  "Dachshund (Salchicha)",
  "Dálmata",
  "Doberman",
  "Dogo Argentino",
  "Fox Terrier",
  "Galgo",
  "Golden Retriever",
  "Husky Siberiano",
  "Jack Russell",
  "Labrador Retriever",
  "Maltés",
  "Pastor Alemán",
  "Pastor Belga",
  "Pequinés",
  "Pitbull / American Staffordshire",
  "Pug",
  "Rottweiler",
  "San Bernardo",
  "Schnauzer",
  "Shar Pei",
  "Shih Tzu",
  "Weimaraner",
  "Yorkshire Terrier",
];

export const RAZAS_GATO = [
  ...RAZAS_COMUNES,
  "Abisinio",
  "Americano de pelo corto",
  "Angora",
  "Bengalí",
  "Birmano",
  "British Shorthair",
  "Burmés",
  "Devon Rex",
  "Exótico de pelo corto",
  "Himalayo",
  "Maine Coon",
  "Noruego del Bosque",
  "Persa",
  "Ragdoll",
  "Russian Blue",
  "Scottish Fold",
  "Siamés",
  "Sphynx",
];

/** @param {string|null|undefined} especie */
export function razasParaEspecie(especie) {
  const e = String(especie || "")
    .trim()
    .toLowerCase();
  if (e.includes("gat") || e.includes("felin") || e === "felino") return RAZAS_GATO;
  return RAZAS_PERRO;
}
