export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function notFound() {
  return new HttpError(404, 'Not found');
}

export function notAvailable() {
  return new HttpError(403, 'Not available');
}
