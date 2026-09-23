export class DomainError extends Error{constructor(public readonly code:string,message:string,public readonly statusCode=400){super(message)}}
