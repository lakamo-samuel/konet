import {NextRequest,NextResponse} from "next/server";
const protectedRoutes=["/discover","/search","/providers","/requests","/quotes","/checkout","/jobs","/messages","/notifications","/profile","/settings","/verification","/verify-student","/provider"];
export function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;const mock=process.env.KONET_DATA_SOURCE==='mock';
 const session=request.cookies.get(mock?'konet_session':'konet_access')?.value;
 if(protectedRoutes.some(route=>path===route||path.startsWith(`${route}/`)) && !session){const url=new URL('/sign-in',request.url);url.searchParams.set('next',path+request.nextUrl.search);return NextResponse.redirect(url);}
 if(mock && path.startsWith('/provider/')) {
  if(request.cookies.get('konet_student_verified')?.value!=='true')return NextResponse.redirect(new URL('/verify-student',request.url));
  if(!path.startsWith('/provider/onboarding') && !request.cookies.get('konet_provider')?.value)return NextResponse.redirect(new URL('/provider/onboarding',request.url));
 }
 const headers=new Headers(request.headers);headers.set('x-konet-pathname',path+request.nextUrl.search);
 return NextResponse.next({request:{headers}});
}
export const config={matcher:["/discover/:path*","/search/:path*","/providers/:path*","/requests/:path*","/quotes/:path*","/checkout/:path*","/jobs/:path*","/messages/:path*","/notifications/:path*","/profile/:path*","/settings/:path*","/verification/:path*","/verify-student","/provider/:path*"]};
