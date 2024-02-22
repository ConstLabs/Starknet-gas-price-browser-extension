/* eslint-disable no-use-before-define */

import {
  getBlocknativeData,
  getEtherscanData,
  getNetworkStatus,
  getETHExchangeRate,
  debounce,
} from "./utils.js";

const DECIMALS_WEI = 1e18;
const DECIMALS_GWEI = 1e9;
const TRANSFER_STEPS = 2809;
const TRANSFER_ERC_20_STEPS = 4701;
const SWAP_STEPS = 9100;
const GAS_STRK_MULTIPLIER = 1405;
const GAS_FIXER = 1;

const gweiToEth = (gwei) => {
  const wei = gwei * DECIMALS_GWEI; // Convert Gwei to Wei
  const eth = wei / DECIMALS_WEI; // Convert Wei to ETH
  return eth;
};

chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (name === "fetch-prices") fetchPrices();
});

// Check whether extension has just been installed
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason == "install") {
    chrome.tabs.create({ url: "introduction.html" });
  }
});

/// Badge
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "local" && changes.prices) {
    const prices = changes.prices.newValue;
    const badgeSource = await getStoredBadgeSource();

    updateBadgeValue({ prices, badgeSource });
  }

  if (areaName === "local" && changes.badgeSource) {
    const prices = await getStoredPrices();
    const badgeSource = changes.badgeSource.newValue;

    updateBadgeValue({ prices, badgeSource });
  }
});

const formatValue = (value) =>
  typeof value === "number" && !isNaN(value)
    ? value > 10
      ? `${Math.trunc(value)}`
      : `${value.toFixed(2)}`
    : "...";

const updateBadgeValue = ({ prices, badgeSource }) => {
  const [preferredProvider, preferredSpeed] = badgeSource.split("|");

  const value =
    prices[preferredProvider][preferredSpeed] ||
    prices.blocknative[preferredSpeed] ||
    prices.etherscan[preferredSpeed];

  if (value) {
    chrome.action.setBadgeText({
      text: formatValue(value),
    });
  }
};

const sleep = (duration) =>
  new Promise((resolve) => setTimeout(resolve, duration));
const lock = {
  state: {
    isLocked: false,
  },

  // Wait and acquire lock
  async acquire() {
    while (this.state.isLocked) {
      await sleep(100); // eslint-disable-line no-await-in-loop
    }

    this.state.isLocked = true;
  },

  release() {
    this.state.isLocked = false;
  },
};

const getStoredBadgeSource = () =>
  new Promise((res) => {
    chrome.storage.local.get(["badgeSource"], (result) => {
      const defaultBadgeSource = "blocknative|1";
      res((result && result.badgeSource) || defaultBadgeSource);
    });
  });

const setStoredBadgeSource = async (badgeSource) =>
  new Promise((res) => {
    chrome.storage.local.set({ badgeSource }, () => res());
  });

const setStoredBadgeContent = async (badgeContent) =>
  new Promise((res) => {
    chrome.storage.local.set({ badgeContent }, () => res());
  });

const getStoredETHExchangeRate = () =>
  new Promise((res) => {
    chrome.storage.local.get(["ETHExchangeRate"], (result) => {
      const defaultETHExchangeRate = 0;
      res((result && result.ETHExchangeRate) || defaultETHExchangeRate);
    });
  });

const setStoredETHExchangeRate = async (ETHExchangeRate) =>
  new Promise((res) => {
    chrome.storage.local.set({ ETHExchangeRate }, () => res());
  });

const getStoredNetworkStatus = () =>
  new Promise((res) => {
    chrome.storage.local.get(["networkStatus"], (result) => {
      const defaultNetworkStatus = "Unknown";
      res((result && result.networkStatus) || defaultNetworkStatus);
    });
  });

const setStoredNetworkStatus = async (networkStatus) =>
  new Promise((res) => {
    chrome.storage.local.set({ networkStatus }, () => res());
  });

const getStoredPrices = () =>
  new Promise((res) => {
    chrome.storage.local.get(["prices"], (result) => {
      res({
        blocknative: (result && result.prices && result.prices.blocknative) || [
          null,
          null,
          null,
        ],
        etherscan: (result && result.prices && result.prices.etherscan) || [
          null,
          null,
          null,
        ],
        Transfer: (result && result.prices && result.prices.Transfer) || [
          null,
          null,
          null,
        ],
        TransferERC20: (result && result.prices && result.prices.TransferERC20) || [
          null,
          null,
          null,
        ],
        Swap: (result && result.prices && result.prices.Swap) || [
          null,
          null,
          null,
        ],
      });
    });
  });

const setStoredPrices = async (prices) =>
  new Promise((res) => {
    chrome.storage.local.set({ prices }, () => res());
  });

const saveFetchedPricesForProvider = async (source, prices) => {
  await lock.acquire();

  const storedPrices = await getStoredPrices();
  const timestamp = Math.trunc(+Date.now() / 1000);

  await setStoredPrices({
    ...storedPrices,
    [source]: prices.concat(timestamp),
  });

  lock.release();
};

const parseStarknetGasPrice = (L1GasPrice, ETHExchangeRate, steps) => {
  const L2GasPriceGwei = L1GasPrice * GAS_FIXER * steps;
  const L2GasPrice = gweiToEth(L2GasPriceGwei);
  const StarknetGasPrice = L2GasPrice * GAS_STRK_MULTIPLIER;
  return [StarknetGasPrice, Math.trunc(L2GasPriceGwei), L2GasPrice * ETHExchangeRate];
};

const fetchPrices = () => {
  /// Fetch all the data
  Promise.all([
    fetchETHExchangeRate().catch((err) => {
      console.error(err);
      return 0; // Default to 0 if there's an error fetching the ETH exchange rate
    }),
    fetchBlocknativeData().catch((err) => {
      console.error(err);
      // Default to this structure if there's an error fetching Blocknative data
      return [
        [null, null, null],
        [null, null, null],
      ];
    }),
  ])
    .then(([ETHExchangeRate, [prices, pricesFeaturedActions]]) => {
      // Once both promises are resolved, handle their results

      // Handle the ETH exchange rate
      setStoredETHExchangeRate(ETHExchangeRate);

      // Handle the Blocknative data
      if (prices && prices[1]) {
        // Ensure there's data to parse
        const transferGasPrice = parseStarknetGasPrice(
          prices[1],
          ETHExchangeRate,
          TRANSFER_STEPS
        );
        const transferERC20GasPrice = parseStarknetGasPrice(
          prices[1],
          ETHExchangeRate,
          TRANSFER_ERC_20_STEPS
        );
        const swapGasPrice = parseStarknetGasPrice(
          prices[1],
          ETHExchangeRate,
          SWAP_STEPS
        );
        saveFetchedPricesForProvider("Swap", swapGasPrice);
        saveFetchedPricesForProvider("TransferERC20", transferERC20GasPrice);
        saveFetchedPricesForProvider("Transfer", transferGasPrice);
      }
      saveFetchedPricesForProvider("blocknative", prices);
    })
    .catch((error) => {
      // Catch any errors that were not caught by the individual catch blocks
      console.error("Error in fetching prices:", error);
    });

  fetchEtherscanData()
    .catch((err) => {
      console.error(err);

      return [null, null, null];
    }) // Default to null if network error
    .then((prices) => saveFetchedPricesForProvider("etherscan", prices));

  fetchNetworkStatus()
    .catch((err) => {
      console.error(err);
      return null;
    })
    .then((networkStatus) => {
      console.log("network:" + networkStatus);
      setStoredNetworkStatus(networkStatus);
    });
};

const fetchBlocknativeData = debounce(async () => {
  const response = await getBlocknativeData();

  const estimatedPrices = response.blockPrices[0].estimatedPrices;

  const fastest = estimatedPrices.find(({ confidence }) => confidence === 99);
  const fast = estimatedPrices.find(({ confidence }) => confidence === 90);
  const standard = estimatedPrices.find(({ confidence }) => confidence === 80);
  const slow = estimatedPrices.find(({ confidence }) => confidence === 60);

  return [
    [fast.price, standard.price, slow.price],
    [
      [fast.maxPriorityFeePerGas, fast.maxFeePerGas],
      [standard.maxPriorityFeePerGas, standard.maxFeePerGas],
      [slow.maxPriorityFeePerGas, slow.maxFeePerGas],
    ],
  ];
});

const fetchEtherscanData = debounce(async () => {
  const {
    result: { SafeGasPrice, ProposeGasPrice, FastGasPrice },
  } = await getEtherscanData();

  return [
    parseInt(FastGasPrice, 10),
    parseInt(ProposeGasPrice, 10),
    parseInt(SafeGasPrice, 10),
  ];
});

const fetchNetworkStatus = debounce(async () => {
  const response = await getNetworkStatus();
  return response;
});

const fetchETHExchangeRate = debounce(async () => {
  const response = await getETHExchangeRate();
  return response;
});

chrome.alarms.create("fetch-prices", { periodInMinutes: 1 });
fetchPrices(); // Not using the `when` option for the alarm because Firefox doesn't run it

// Set initial properties when the extension launches; since this isn't
// a persistent background script, it may be regularly shut down and initialized
// again: testing for the value of text allows to only apply initia value on the
// first initialization
chrome.action.getBadgeText({}, (text) => {
  const isInitialRun = text === "";
  if (isInitialRun) chrome.action.setBadgeText({ text: "…" });
});
chrome.action.setBadgeBackgroundColor({ color: "#4db8ff" });

chrome.runtime.onMessage.addListener(({ action, ...data } = {}) => {
  if (action === "refresh-data") fetchPrices();
  if (action === "update-badge-source") setStoredBadgeSource(data.badgeSource);
  if (action === "update-badge-content") setStoredBadgeContent(data.content);
});
