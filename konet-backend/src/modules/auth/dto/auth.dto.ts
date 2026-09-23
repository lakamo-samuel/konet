import {ApiProperty} from "@nestjs/swagger";import {IsEmail,IsString,IsUUID,MinLength} from "class-validator";
export class RegisterDto{@ApiProperty() @IsEmail() email!:string;@ApiProperty() @IsString() @MinLength(8) password!:string;@ApiProperty() @IsString() @MinLength(2) fullName!:string;@ApiProperty() @IsUUID() universityId!:string;@ApiProperty() @IsUUID() campusId!:string}
export class LoginDto{@ApiProperty() @IsEmail() email!:string;@ApiProperty() @IsString() password!:string}
export class ForgotPasswordDto{@IsEmail() email!:string}export class ResetPasswordDto{@IsString() token!:string;@MinLength(8) password!:string}
