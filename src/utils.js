const now = () => +Date.now() / 1000;

const memoizeAsync = (fn) => {
  const CACHE_DURATION = 10;

  let lastRunTs = 0;
  let cache;

  return async () => {
    const isCacheExpired = now() - lastRunTs > CACHE_DURATION;

    if (isCacheExpired) {
      lastRunTs = now();
      cache = await fn();
    }

    return cache;
  };
};

const debounce = (fn) => {
  let timeoutId;

  return () =>
    new Promise((resolve) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => resolve(fn()), 500);
    });
};

const getBlocknativeData = memoizeAsync(async () =>
  (
    await fetch(
      "https://api.blocknative.com/gasprices/blockprices?confidenceLevels=99&confidenceLevels=90&confidenceLevels=80&confidenceLevels=60"
    )
  ).json()
);

const getEtherscanData = memoizeAsync(async () =>
  (
    await fetch(
      "https://api.etherscan.io/api?module=gastracker&action=gasoracle"
    )
  ).json()
);

const getNetworkStatus = memoizeAsync(
  async () =>
    await fetch("https://status.starknet.io/")
      .then((response) => response.text())
      .then((html) => {
        const regex =
          /<div class="page-status[^"]*">\s*<span class="status font-large">\s*([\s\S]*?)\s*<\/span>/;
        const match = html.match(regex);
        if (match && match[1]) {
          return match[1].trim();
        } else {
          console.log("Page Status element not found.");
          return null;
        }
      })
);

const getETHExchangeRate = memoizeAsync(
  async () =>
    await fetch("https://api.coinbase.com/v2/exchange-rates?currency=ETH")
      .then((response) => response.json())
      .then((data) => {
        const ETHRate = data.data.rates.USDT;
        console.log(`ETH Rate for USDT: ${ETHRate}`);
        return ETHRate;
      })
      .catch((error) => {
        console.error("Error fetching the ETH rate:", error);
        return null;
      })
);

export { debounce, getBlocknativeData, getEtherscanData, getNetworkStatus, getETHExchangeRate};
