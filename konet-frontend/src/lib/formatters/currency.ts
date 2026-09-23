export function formatNaira(value:number){return new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(value).replace("NGN","₦");}
