import { Global, Module } from '@nestjs/common';
import { TypedEventEmitter } from './typed-event-emitter';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [TypedEventEmitter],
  exports: [TypedEventEmitter],
})
export class EventsModule {}
