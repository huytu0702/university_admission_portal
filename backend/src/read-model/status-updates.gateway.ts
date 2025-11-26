import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export type StatusEvent = {
  applicationId: string;
  status: string;
  progress?: number | null;
  updatedAt: Date;
};

@Injectable()
export class ApplicationStatusStream {
  private readonly subject = new Subject<StatusEvent>();

  emit(event: StatusEvent) {
    this.subject.next(event);
  }

  stream(): Observable<MessageEvent> {
    return this.subject.asObservable() as Observable<MessageEvent>;
  }
}
