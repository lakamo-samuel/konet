import {currentUser,users} from "@/data/mock/users";
export async function getCurrentUser(){return currentUser;}
export async function getUserById(id:string){return users.find(item=>item.id===id)??null;}
