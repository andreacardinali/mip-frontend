import axios from "axios";

import api from "../api/api";

type ImportSymbolRequest = {
  symbol: string;
  data_source?: string | null;
};

type ImportSymbolResponse = {
  entity_id: string;
  instrument_id: string;
  imported: boolean;
  source: string;
  price_available?: boolean;
};

const IMPORT_WARNING_MS = 5_000;
const IMPORT_TIMEOUT_MS = 35_000;

export async function importSymbol(
  request: ImportSymbolRequest
): Promise<ImportSymbolResponse> {
  const symbol =
    request.symbol.trim().toUpperCase();
  const dataSource =
    request.data_source ?? "YAHOO";
  const startedAt = performance.now();
  const requestId =
    `${symbol}-${Date.now()}`;

  console.groupCollapsed(
    `[MIP import] START ${symbol}`
  );
  console.info({
    requestId,
    symbol,
    dataSource,
    warningAfterMs: IMPORT_WARNING_MS,
    clientTimeoutMs: IMPORT_TIMEOUT_MS,
  });
  console.groupEnd();

  const warningTimer = window.setTimeout(
    () => {
      console.warn(
        `[MIP import] SLOW ${symbol}: request still pending after ${IMPORT_WARNING_MS} ms`,
        {
          requestId,
          symbol,
          dataSource,
        }
      );
    },
    IMPORT_WARNING_MS
  );

  try {
    const response =
      await api.post<ImportSymbolResponse>(
        "/import/entity",
        {
          symbol,
          data_source:
            request.data_source
            ?? undefined,
        },
        {
          timeout: IMPORT_TIMEOUT_MS,
        }
      );

    const durationMs = Math.round(
      performance.now() - startedAt
    );

    console.info(
      `[MIP import] OK ${symbol} in ${durationMs} ms`,
      {
        requestId,
        symbol,
        dataSource,
        durationMs,
        status: response.status,
        source: response.data.source,
        imported: response.data.imported,
        priceAvailable:
          response.data.price_available,
        entityId:
          response.data.entity_id,
        instrumentId:
          response.data.instrument_id,
      }
    );

    if (
      response.data.price_available
      === false
    ) {
      console.warn(
        `[MIP import] NO PRICE ${symbol}`,
        {
          requestId,
          symbol,
          dataSource,
          durationMs,
          response: response.data,
        }
      );
    }

    return response.data;
  } catch (error) {
    const durationMs = Math.round(
      performance.now() - startedAt
    );

    if (
      axios.isAxiosError(error)
      && error.code === "ECONNABORTED"
    ) {
      console.error(
        `[MIP import] CLIENT TIMEOUT ${symbol} after ${durationMs} ms`,
        {
          requestId,
          symbol,
          dataSource,
          durationMs,
          timeoutMs: IMPORT_TIMEOUT_MS,
          code: error.code,
          message: error.message,
        }
      );
    } else if (axios.isAxiosError(error)) {
      console.error(
        `[MIP import] HTTP ERROR ${symbol} after ${durationMs} ms`,
        {
          requestId,
          symbol,
          dataSource,
          durationMs,
          code: error.code,
          status: error.response?.status,
          response: error.response?.data,
          message: error.message,
        }
      );
    } else {
      console.error(
        `[MIP import] ERROR ${symbol} after ${durationMs} ms`,
        {
          requestId,
          symbol,
          dataSource,
          durationMs,
          error,
        }
      );
    }

    throw error;
  } finally {
    window.clearTimeout(warningTimer);
  }
}
