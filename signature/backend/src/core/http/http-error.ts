export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: number;

  constructor(statusCode: number, message: string, code?: number) {
    super(message);
    this.statusCode = statusCode;
    this.code = code ?? statusCode;
    this.name = "HttpError";
  }
}