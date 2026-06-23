import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import * as signalR from '@microsoft/signalr';

import { environment } from '../../../environments/environment';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class AdminRealtimeNotificationService {
  private connection?: signalR.HubConnection;
  private activeToken?: string;
  private startPromise?: Promise<void>;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly zone: NgZone,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {}

  start(authToken: string | null | undefined): Promise<void> | undefined {
    if (!isPlatformBrowser(this.platformId) || !authToken) {
      return undefined;
    }

    if (this.connection && this.activeToken === authToken) {
      return this.startPromise;
    }

    if (this.connection) {
      void this.stop();
    }

    this.activeToken = authToken;
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/admin-notifications`, {
        accessTokenFactory: () => authToken,
      })
      .withAutomaticReconnect()
      .build();

    this.connection.on('BookingActivityReceived', (notification: unknown) => {
      this.zone.run(() => {
        this.notificationService.receiveBookingActivityNotification(notification);
      });
    });

    this.startPromise = this.connection.start().catch((error) => {
      console.error('Failed to start admin realtime notifications', error);
      this.connection = undefined;
      this.activeToken = undefined;
      this.startPromise = undefined;
    });

    return this.startPromise;
  }

  stop(): Promise<void> | undefined {
    const connection = this.connection;

    this.connection = undefined;
    this.activeToken = undefined;
    this.startPromise = undefined;

    if (!connection) {
      return undefined;
    }

    connection.off('BookingActivityReceived');
    return connection.stop().catch((error) => {
      console.error('Failed to stop admin realtime notifications', error);
    });
  }
}
