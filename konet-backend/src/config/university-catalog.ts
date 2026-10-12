export type CatalogUniversity = {
  name: string;
  shortName: string;
  slug: string;
  city: string;
  state: string;
  campuses: string[];
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function school(
  name: string,
  city: string,
  state: string,
  campuses = ["Main Campus"],
  slug = slugify(name),
): CatalogUniversity {
  const words = name.match(/[A-Za-z0-9]+/g) ?? [];
  const initials = words
    .filter((word) => !["of", "the", "and", "for"].includes(word.toLowerCase()))
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return {
    name,
    shortName: name.length <= 50 ? name : `${initials} ${city}`.slice(0, 50),
    slug,
    city,
    state,
    campuses,
  };
}

export const universityCatalog: CatalogUniversity[] = [
  school("Ahmadu Bello University, Zaria", "Zaria", "Kaduna", ["Samaru (main)", "Kongo", "Shika", "Kaduna"]),
  school("Bayero University, Kano", "Kano", "Kano", ["Old Campus", "New Campus"]),
  school("Obafemi Awolowo University, Ile-Ife", "Ile-Ife", "Osun"),
  school("University of Benin", "Benin City", "Edo", ["Ugbowo (main)", "Ekehuan (health sciences)"]),
  school("University of Calabar", "Calabar", "Cross River"),
  school("University of Ibadan", "Ibadan", "Oyo"),
  school("University of Ilorin", "Ilorin", "Kwara", ["Main Campus", "Tanke"]),
  school("University of Jos", "Jos", "Plateau", ["Naraguta (main)", "Bauchi Road"]),
  school("University of Lagos", "Lagos", "Lagos", ["Akoka (main)", "Idi-Araba (College of Medicine)"], "unilag"),
  school("University of Maiduguri", "Maiduguri", "Borno"),
  school("University of Nigeria, Nsukka", "Nsukka", "Enugu", ["Nsukka (main)", "Enugu", "Ituku-Ozalla (College of Medicine)", "Aba"], "unn"),
  school("University of Port Harcourt", "Port Harcourt", "Rivers", ["Choba (main)", "Abuja campus", "Delta campus"]),
  school("University of Uyo", "Uyo", "Akwa Ibom", ["Main Campus", "Town Campus"]),
  school("University of Abuja", "Abuja", "Federal Capital Territory"),
  school("Usmanu Danfodiyo University, Sokoto", "Sokoto", "Sokoto", ["Permanent Site", "City Campus"]),
  school("Nnamdi Azikiwe University, Awka", "Awka", "Anambra", ["Awka (main)", "Nnewi (medicine)"]),
  school("National Open University of Nigeria", "Abuja", "Federal Capital Territory"),

  school("Federal University of Technology, Akure", "Akure", "Ondo"),
  school("Federal University of Technology, Minna", "Minna", "Niger", ["Gidan Kwano (main)", "Bosso"], "fut-minna"),
  school("Federal University of Technology, Owerri", "Owerri", "Imo"),
  school("Federal University of Technology, Ikot Abasi", "Ikot Abasi", "Akwa Ibom"),
  school("Federal University of Technology, Babura", "Babura", "Jigawa"),
  school("Abubakar Tafawa Balewa University, Bauchi", "Bauchi", "Bauchi", ["Gubi (main)", "Yelwa"]),
  school("Modibbo Adama University, Yola", "Yola", "Adamawa"),
  school("Federal University of Agriculture, Abeokuta", "Abeokuta", "Ogun"),
  school("Michael Okpara University of Agriculture, Umudike", "Umudike", "Abia"),
  school("Joseph Sarwuan Tarka University, Makurdi", "Makurdi", "Benue"),
  school("Federal University of Agriculture, Zuru", "Zuru", "Kebbi"),
  school("Federal University of Petroleum Resources, Effurun", "Effurun", "Delta"),
  school("Federal University of Transportation, Daura", "Daura", "Katsina"),

  school("Federal University, Dutse", "Dutse", "Jigawa"),
  school("Federal University, Dutsin-Ma", "Dutsin-Ma", "Katsina"),
  school("Federal University, Gashua", "Gashua", "Yobe"),
  school("Federal University, Gusau", "Gusau", "Zamfara"),
  school("Federal University, Kashere", "Kashere", "Gombe"),
  school("Federal University, Lafia", "Lafia", "Nasarawa"),
  school("Federal University, Lokoja", "Lokoja", "Kogi"),
  school("Federal University, Otuoke", "Otuoke", "Bayelsa"),
  school("Federal University, Oye-Ekiti", "Oye-Ekiti", "Ekiti"),
  school("Federal University, Wukari", "Wukari", "Taraba"),
  school("Federal University, Birnin Kebbi", "Birnin Kebbi", "Kebbi"),
  school("Alex Ekwueme Federal University, Ndufu-Alike", "Ndufu-Alike", "Ebonyi"),
  school("Federal University of Health Sciences, Otukpo", "Otukpo", "Benue"),
  school("Federal University of Health Sciences, Azare", "Azare", "Bauchi"),
  school("Federal University of Allied Health Sciences, Enugu", "Enugu", "Enugu"),
  school("David Umahi Federal University of Health Sciences, Uburu", "Uburu", "Ebonyi"),

  school("Federal University of Environment and Technology, Ogoni", "Ogoni", "Rivers"),
  school("Federal University of Applied Sciences, Kachia", "Kachia", "Kaduna"),
  school("Federal University of Agriculture and Development Studies, Iragbiji", "Iragbiji", "Osun"),
  school("Federal University of Technology and Environmental Sciences, Iyin-Ekiti", "Iyin-Ekiti", "Ekiti"),
  school("Federal University of Agriculture and Technology, Okeho", "Okeho", "Oyo"),

  school("Nigerian Defence Academy, Kaduna", "Kaduna", "Kaduna"),
  school("Nigerian Army University, Biu", "Biu", "Borno"),
  school("Air Force Institute of Technology, Kaduna", "Kaduna", "Kaduna"),
  school("Nigerian Police Academy, Wudil", "Wudil", "Kano"),
  school("Nigerian Maritime University, Okerenkoko", "Okerenkoko", "Delta"),

  school("Lagos State University, Ojo", "Ojo", "Lagos", ["Ojo (main)", "Epe", "Ikeja (College of Medicine)"]),
  school("Lagos State University of Science and Technology, Ikorodu", "Ikorodu", "Lagos"),
  school("Lagos State University of Education, Ijanikin", "Ijanikin", "Lagos"),
  school("Olabisi Onabanjo University, Ago-Iwoye", "Ago-Iwoye", "Ogun", ["Ago-Iwoye (main)", "Ibogun", "Ayetoro", "Sagamu (medicine)"]),
  school("Tai Solarin University of Education, Ijebu-Ode", "Ijebu-Ode", "Ogun"),
  school("Moshood Abiola University of Science and Technology, Abeokuta", "Abeokuta", "Ogun"),
  school("Ladoke Akintola University of Technology, Ogbomoso", "Ogbomoso", "Oyo", ["Ogbomoso (main)", "Osogbo (medicine)"]),
  school("Oyo State Technical University, Ibadan", "Ibadan", "Oyo"),
  school("Osun State University, Osogbo", "Osogbo", "Osun"),
  school("Ekiti State University, Ado-Ekiti", "Ado-Ekiti", "Ekiti"),
  school("Bamidele Olumilua University of Education, Ikere-Ekiti", "Ikere-Ekiti", "Ekiti"),
  school("Adekunle Ajasin University, Akungba-Akoko", "Akungba-Akoko", "Ondo"),
  school("Olusegun Agagu University of Science and Technology, Okitipupa", "Okitipupa", "Ondo"),
  school("University of Medical Sciences, Ondo", "Ondo", "Ondo"),

  school("Delta State University, Abraka", "Abraka", "Delta", ["Abraka (main)", "Asaba", "Oleh"]),
  school("Delta State University of Science and Technology, Ozoro", "Ozoro", "Delta"),
  school("Dennis Osadebay University, Asaba", "Asaba", "Delta"),
  school("Ambrose Alli University, Ekpoma", "Ekpoma", "Edo"),
  school("Edo State University, Uzairue", "Uzairue", "Edo"),
  school("Rivers State University, Port Harcourt", "Port Harcourt", "Rivers"),
  school("Ignatius Ajuru University of Education, Port Harcourt", "Port Harcourt", "Rivers"),
  school("Niger Delta University, Wilberforce Island", "Wilberforce Island", "Bayelsa"),
  school("Bayelsa Medical University, Yenagoa", "Yenagoa", "Bayelsa"),
  school("Akwa Ibom State University, Ikot Akpaden", "Ikot Akpaden", "Akwa Ibom"),
  school("Cross River University of Technology, Calabar", "Calabar", "Cross River"),

  school("Abia State University, Uturu", "Uturu", "Abia", ["Uturu (main)", "Aba"]),
  school("Chukwuemeka Odumegwu Ojukwu University, Uli", "Uli", "Anambra", ["Uli (main)", "Igbariam", "Mgbakwu"]),
  school("Ebonyi State University, Abakaliki", "Abakaliki", "Ebonyi", ["Abakaliki (main)", "Presco Campus"]),
  school("Enugu State University of Science and Technology", "Enugu", "Enugu", ["Agbani", "Park Lane (Enugu)"]),
  school("State University of Medical and Applied Sciences, Igbo-Eno", "Igbo-Eno", "Enugu"),
  school("Imo State University, Owerri", "Owerri", "Imo"),

  school("Benue State University, Makurdi", "Makurdi", "Benue"),
  school("Kogi State University (Prince Abubakar Audu University), Anyigba", "Anyigba", "Kogi"),
  school("Confluence University of Science and Technology, Osara", "Osara", "Kogi"),
  school("Kwara State University, Malete", "Malete", "Kwara"),
  school("Nasarawa State University, Keffi", "Keffi", "Nasarawa", ["Keffi (main)", "Shabu-Lafia"]),
  school("Ibrahim Badamasi Babangida University, Lapai", "Lapai", "Niger"),
  school("Abdulkadir Kure University, Minna", "Minna", "Niger"),
  school("Plateau State University, Bokkos", "Bokkos", "Plateau"),

  school("Kaduna State University", "Kaduna", "Kaduna", ["Main Campus (Kaduna)", "Kafanchan"]),
  school("Aliko Dangote University of Science and Technology, Wudil", "Wudil", "Kano"),
  school("Yusuf Maitama Sule University, Kano", "Kano", "Kano"),
  school("Umaru Musa Yar’Adua University, Katsina", "Katsina", "Katsina"),
  school("Kebbi State University of Science and Technology, Aliero", "Aliero", "Kebbi"),
  school("Sokoto State University", "Sokoto", "Sokoto"),
  school("Sule Lamido University, Kafin Hausa", "Kafin Hausa", "Jigawa"),

  school("Adamawa State University, Mubi", "Mubi", "Adamawa"),
  school("Bauchi State University, Gadau", "Gadau", "Bauchi"),
  school("Borno State University, Maiduguri", "Maiduguri", "Borno"),
  school("Gombe State University", "Gombe", "Gombe"),
  school("Gombe State University of Science and Technology, Kumo", "Kumo", "Gombe"),
  school("Taraba State University, Jalingo", "Jalingo", "Taraba"),
  school("Yobe State University, Damaturu", "Damaturu", "Yobe"),
];