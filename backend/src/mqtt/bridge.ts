import mqtt, { type IClientOptions, type MqttClient } from "mqtt";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { insertSeriesReading, type ReadingValues } from "../services/readings.js";

const topicPartPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;

type TopicKind = "command" | "state" | "telemetry" | "availability";

function normalizeTopicPrefix(prefix: string) {
  return prefix.replace(/^\/+|\/+$/g, "");
}

function parseTopic(topic: string) {
  const parts = topic.split("/");
  const prefixParts = normalizeTopicPrefix(config.MQTT_TOPIC_PREFIX).split("/");

  if (parts.length !== prefixParts.length + 3) {
    return null;
  }

  for (let i = 0; i < prefixParts.length; i++) {
    if (parts[i] !== prefixParts[i]) {
      return null;
    }
  }

  const [seriesKey, deviceId, kind] = parts.slice(prefixParts.length);
  if (!["command", "state", "telemetry", "availability"].includes(kind)) {
    return null;
  }

  return {
    seriesKey,
    deviceId,
    kind: kind as TopicKind
  };
}

function parsePayload(payload: Buffer, kind: TopicKind): ReadingValues {
  const text = payload.toString("utf8").trim();

  if (kind === "availability") {
    return {
      availability: text,
      mqtt_connected: text === "online"
    };
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { raw_payload: text };
    }

    const values: ReadingValues = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        values[key] = value;
      }
    }

    return Object.keys(values).length > 0 ? values : { raw_payload: text };
  } catch {
    return { raw_payload: text };
  }
}

class MqttBridge {
  private client: MqttClient | null = null;
  private started = false;

  start() {
    if (!config.MQTT_ENABLED || this.started) {
      return;
    }

    this.started = true;

    const options: IClientOptions = {
      reconnectPeriod: 3000,
      connectTimeout: 10000,
      clean: true,
      clientId: `smart-home-backend-${randomUUID()}`
    };

    if (config.MQTT_USERNAME) {
      options.username = config.MQTT_USERNAME;
    }

    if (config.MQTT_PASSWORD) {
      options.password = config.MQTT_PASSWORD;
    }

    this.client = mqtt.connect(config.MQTT_BROKER_URL, options);

    this.client.on("connect", () => {
      const prefix = normalizeTopicPrefix(config.MQTT_TOPIC_PREFIX);
      const topics = [
        `${prefix}/+/+/state`,
        `${prefix}/+/+/telemetry`,
        `${prefix}/+/+/availability`
      ];

      this.client?.subscribe(topics, { qos: 1 }, (error) => {
        if (error) {
          console.error("MQTT subscribe failed", error);
          return;
        }

        console.log(`MQTT bridge subscribed to ${topics.join(", ")}`);
      });
    });

    this.client.on("message", (topic, payload) => {
      void this.handleMessage(topic, payload);
    });

    this.client.on("error", (error) => {
      console.error("MQTT bridge error", error.message);
    });
  }

  async stop() {
    if (!this.client) {
      return;
    }

    const client = this.client;
    this.client = null;

    await new Promise<void>((resolve) => {
      client.end(false, {}, () => resolve());
    });
  }

  async publishRelayCommand(deviceId: string, relayOn: boolean) {
    if (!topicPartPattern.test(deviceId)) {
      throw new Error("deviceId must use lowercase letters, numbers, hyphens, or underscores");
    }

    if (!this.client) {
      throw new Error("MQTT bridge is not started");
    }

    const commandId = `cmd-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const topic = `${normalizeTopicPrefix(config.MQTT_TOPIC_PREFIX)}/p_series/${deviceId}/command`;
    const payload = {
      command_id: commandId,
      relay_on: relayOn,
      issued_at: new Date().toISOString(),
      source: "backend"
    };

    await insertSeriesReading("p_series", {
      relay_on: relayOn,
      relay_command_id: commandId
    }, {
      kind: "command_issued",
      series_key: "p_series",
      device_id: deviceId,
      transport: "mqtt",
      source: "backend",
      topic
    });

    await new Promise<void>((resolve, reject) => {
      this.client?.publish(
        topic,
        JSON.stringify(payload),
        { qos: 1, retain: true },
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        }
      );
    });

    return {
      deviceId,
      topic,
      command: payload
    };
  }

  private async handleMessage(topic: string, payload: Buffer) {
    const parsedTopic = parseTopic(topic);
    if (!parsedTopic) {
      return;
    }

    try {
      await insertSeriesReading(
        parsedTopic.seriesKey,
        parsePayload(payload, parsedTopic.kind),
        {
          kind: parsedTopic.kind,
          series_key: parsedTopic.seriesKey,
          device_id: parsedTopic.deviceId,
          transport: "mqtt",
          source: "mqtt_bridge",
          topic
        }
      );
    } catch (error) {
      console.error(`Failed to store MQTT message from ${topic}`, error);
    }
  }
}

export const mqttBridge = new MqttBridge();
