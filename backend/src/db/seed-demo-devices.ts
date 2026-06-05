import { randomUUID } from "node:crypto";
import { closePool, pool } from "./pool.js";
import { createBaseSchema, ensureSeriesTable } from "./schema.js";

const demoDevices = [
  {
    productCode: "K-DEMO-0001",
    seriesKey: "k_series",
    deviceId: "k-series-001",
    displayName: "K 系列廚房環境感測器",
    modelName: "K Series",
    seriesDisplayName: "K 系列",
    capabilities: {
      flameDetection: true,
      airQuality: true,
      temperatureHumidity: true,
      gasAnalog: true,
      rgbStatusLed: true,
      relayControl: false
    }
  },
  {
    productCode: "M-DEMO-0001",
    seriesKey: "m_series",
    deviceId: "m-series-001",
    displayName: "M 系列主控環境站",
    modelName: "M Series",
    seriesDisplayName: "M 系列",
    capabilities: {
      mainPanel: true,
      oledDisplay: true,
      airQuality: true,
      temperatureHumidity: true,
      gasAnalog: true,
      rgbStatusLed: true,
      relayControl: false
    }
  },
  {
    productCode: "P-DEMO-0001",
    seriesKey: "p_series",
    deviceId: "p-series-001",
    displayName: "P 系列智慧插座",
    modelName: "P Series",
    seriesDisplayName: "P 系列",
    capabilities: {
      smartPlug: true,
      mqtt: true,
      relayControl: true,
      availability: true,
      telemetry: true
    }
  },
  {
    productCode: "R-DEMO-0001",
    seriesKey: "r_series",
    deviceId: "r-series-001",
    displayName: "R 系列房間感測器",
    modelName: "R Series",
    seriesDisplayName: "R 系列",
    capabilities: {
      compactSensor: true,
      airQuality: true,
      temperatureHumidity: true,
      gasAnalog: true,
      rgbStatusLed: true,
      relayControl: false
    }
  },
  {
    productCode: "T-DEMO-0001",
    seriesKey: "t_series",
    deviceId: "t-series-001",
    displayName: "T 系列人體存在感測器",
    modelName: "T Series",
    seriesDisplayName: "T 系列",
    capabilities: {
      presenceDetection: true,
      airQuality: true,
      temperatureHumidity: true,
      gasAnalog: true,
      rgbStatusLed: true,
      relayControl: false
    }
  }
] as const;

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await createBaseSchema(client);

    for (const device of demoDevices) {
      await ensureSeriesTable(client, device.seriesKey);

      await client.query(
        `
          INSERT INTO hardware_series (series_key, display_name)
          VALUES ($1, $2)
          ON CONFLICT (series_key) DO UPDATE
          SET display_name = EXCLUDED.display_name,
              updated_at = now();
        `,
        [device.seriesKey, device.seriesDisplayName]
      );

      await client.query(
        `
          INSERT INTO devices (
            id,
            product_code,
            series_key,
            device_id,
            display_name,
            model_name,
            capabilities
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (product_code) DO UPDATE
          SET series_key = EXCLUDED.series_key,
              device_id = EXCLUDED.device_id,
              display_name = EXCLUDED.display_name,
              model_name = EXCLUDED.model_name,
              capabilities = EXCLUDED.capabilities,
              updated_at = now();
        `,
        [
          randomUUID(),
          device.productCode,
          device.seriesKey,
          device.deviceId,
          device.displayName,
          device.modelName,
          JSON.stringify(device.capabilities)
        ]
      );
    }

    await client.query("COMMIT");
    console.log(`Seeded ${demoDevices.length} demo devices.`);
    for (const device of demoDevices) {
      console.log(`${device.productCode} -> ${device.deviceId}`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

main().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
