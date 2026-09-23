import type { User } from "@/types/domain";
const photo=(id:string)=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=240&q=85`;
export const users:User[]=[
 {id:"samuel",name:"Samuel Adeyemi",email:"samuel@st.futminna.edu.ng",avatar:photo("photo-1500648767791-00dcc994a43e"),universityId:"futminna",campus:"Bosso",studentVerification:"verified",identityVerification:"verified"},
 {id:"aisha-user",name:"Aisha Bello",email:"aisha@st.futminna.edu.ng",avatar:photo("photo-1531123897727-8f129e1688ce"),universityId:"futminna",campus:"Bosso",studentVerification:"verified",identityVerification:"verified",providerProfileId:"aisha"},
];
export const currentUser=users[0];
