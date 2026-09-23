import {notifications} from "@/data/mock/jobs";
export async function getNotificationsForUser(userId:string){return notifications.filter(item=>item.userId===userId);}
