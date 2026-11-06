import {
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
} from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { hostname } from 'node:os';

@Injectable()
export class ConsulRegistrationService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(ConsulRegistrationService.name);
  private readonly consulUrl = process.env.CONSUL_HTTP_ADDR?.trim();
  private readonly serviceName =
    process.env.SERVICE_NAME?.trim() || 'visit-service';
  private readonly instanceHost = hostname();
  private readonly instanceId = this.serviceName + '-' + this.instanceHost;
  private timer?: NodeJS.Timeout;
  private registering?: Promise<void>;
  private attempted = false;

  start(port: number): void {
    if (!this.consulUrl || this.timer) return;
    const register = () => {
      if (this.registering) return;
      this.registering = this.register(port).finally(() => {
        this.registering = undefined;
      });
    };
    register();
    this.timer = setInterval(register, 60_000);
    this.timer.unref();
  }

  async beforeApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.registering;
    if (!this.attempted) return;

    try {
      await this.put(
        '/v1/agent/service/deregister/' + encodeURIComponent(this.instanceId),
      );
    } catch (error) {
      this.logger.warn({
        message: 'No se pudo dar de baja Visit en Consul',
        errorType: error instanceof Error ? error.name : typeof error,
      });
    }
  }

  private async register(port: number): Promise<void> {
    try {
      const address =
        process.env.SERVICE_ADDRESS?.trim() ||
        (await lookup(this.instanceHost)).address;
      const host = isIP(address) === 6 ? '[' + address + ']' : address;
      this.attempted = true;
      await this.put('/v1/agent/service/register', {
        ID: this.instanceId,
        Name: this.serviceName,
        Address: address,
        Port: port,
        Check: {
          HTTP: 'http://' + host + ':' + port + '/health',
          Interval: '10s',
          Timeout: '2s',
          DeregisterCriticalServiceAfter: '1m',
        },
      });
    } catch (error) {
      this.logger.warn({
        message: 'No se pudo registrar Visit en Consul',
        errorType: error instanceof Error ? error.name : typeof error,
      });
    }
  }

  private async put(path: string, body?: object): Promise<void> {
    const response = await fetch(new URL(path, this.consulUrl), {
      method: 'PUT',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(2000),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error('Consul respondió ' + response.status);
  }
}
