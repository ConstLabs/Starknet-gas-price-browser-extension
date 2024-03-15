const refreshButtonEl = document.querySelector("#refresh-button");

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

const getStoredBadgeSource = () =>
  new Promise((res) => {
    chrome.storage.local.get(["badgeSource"], (result) => {
      const defaultBadgeSource = "blocknative|1";
      res((result && result.badgeSource) || defaultBadgeSource);
    });
  });

const getStoredNetworkStatus = () =>
  new Promise((res) => {
    chrome.storage.local.get(["networkStatus"], (result) => {
      const defaultNetworkStatus = "Unknown";
      res((result && result.networkStatus) || defaultNetworkStatus);
    });
  });

const formatPrice = (price) => (price === null ? "..." : Math.trunc(price));
const formatStarknetPrice = (price) => (price === null ? "..." : price);
const formatHtml = (prices) =>
  prices === null ? "..." : `${prices[0]}<br />${prices[1]}`;

const updateDOMForProvider = (provider, prices) => {
  if (provider === "Transfer" || provider === "Swap" || provider === "TransferERC20") {
    document.querySelector(`#${provider} .strk`).textContent = formatStarknetPrice(
      prices[provider][0].toFixed(6)
    );
    document.querySelector(`#${provider} .eth`).textContent = formatStarknetPrice(
      prices[provider][1]
    );
    document.querySelector(`#${provider} .USDT`).textContent = formatStarknetPrice(
      prices[provider][2].toFixed(3)
    );
  } else {
    console.log("p2:"+prices[provider]);
    document.querySelector(`#${provider} .fast`).textContent = formatPrice(
      prices[provider][0]
    );
    document.querySelector(`#${provider} .normal`).textContent = formatPrice(
      prices[provider][1]
    );
    document.querySelector(`#${provider} .slow`).textContent = formatPrice(
      prices[provider][2]
    );
  }

  const hasData =
    prices[provider][0] !== null &&
    prices[provider][1] !== null &&
    prices[provider][2] !== null;

  document
    .querySelector(`#${provider} .timestamp`)
    .setAttribute("data-timestamp", hasData ? prices[provider][3] : "");
};

const updateDOMForNetworkStatus = (networkStatus) => {
  document.querySelector("#network-status").textContent = networkStatus;
};

const updateDOM = (prices, networkStatus) => {
  updateDOMForProvider("blocknative", prices);
  updateDOMForProvider("etherscan", prices);
  // Starknet's providers
  updateDOMForProvider("Transfer", prices);
  updateDOMForProvider("TransferERC20", prices);
  updateDOMForProvider("Swap", prices);
  if (networkStatus) {
    updateDOMForNetworkStatus(networkStatus);
  }
  
  if (refreshButtonEl.getAttribute("data-content-loaded") !== "true") {
    refreshButtonEl.setAttribute("data-content-loaded", "true");
  }
};

const updateDOMForBadgeSource = (badgeSource) => {
  document
    .querySelectorAll(
      `table td[data-source]:not([data-source="${badgeSource}"])`
    )
    .forEach((el) => {
      el.removeAttribute("data-selected");
      el.setAttribute("title", "Display this value in the badge");
    });

  const preferredEl = document.querySelector(
    `table td[data-source="${badgeSource}"]`
  );
  console.log(badgeSource + preferredEl);
  preferredEl.setAttribute("data-selected", "true");
  preferredEl.removeAttribute("title");
};

const updateTimestampDisplayDOM = (el) => {
  const timestampNow = Math.trunc(+Date.now() / 1000);
  const timestampThen = el.getAttribute("data-timestamp");

  if (timestampThen) {
    const secDiff = timestampNow - timestampThen;
    const diffText = secDiff === 0 ? "just now" : `${secDiff}s ago`;

    el.textContent = diffText; // eslint-disable-line no-param-reassign
  } else {
    el.textContent = ""; // eslint-disable-line no-param-reassign
  }
};

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.prices) {
    const newPrices = changes.prices.newValue;
    updateDOM(newPrices);
  }

  if (areaName === "local" && changes.badgeSource) {
    const newBadgeSource = changes.badgeSource.newValue;
    updateDOMForBadgeSource(newBadgeSource);
  }
});

const timestampEls = document.querySelectorAll(".timestamp");
const updateTimestampDisplay = () =>
  timestampEls.forEach((el) => updateTimestampDisplayDOM(el));
setInterval(updateTimestampDisplay, 500);

Promise.all([
  getStoredPrices(),
  getStoredBadgeSource(),
  getStoredNetworkStatus(),
])
  .then(([prices, badgeSource, networkStatus]) => {
    updateDOM(prices, networkStatus);
    updateDOMForBadgeSource(badgeSource);
  })
  .then(() => updateTimestampDisplay());

refreshButtonEl.addEventListener("click", () => {
  if (refreshButtonEl.getAttribute("data-content-loaded") === "true") {
    refreshButtonEl.setAttribute("data-content-loaded", "false");
    chrome.runtime.sendMessage({ action: "refresh-data" });
  }
});

document.querySelector("#L1Gas").addEventListener("click", ({ target }) => {
  const badgeSource = target.getAttribute("data-source");
  console.log("source:" + badgeSource);
  if (badgeSource) {
    chrome.runtime.sendMessage({ action: "update-badge-source", badgeSource });
  }
});

document
  .querySelector("#StarknetGas")
  .addEventListener("click", ({ target }) => {
    const badgeSource = target.getAttribute("data-source");
    console.log("source:" + badgeSource);
    if (badgeSource) {
      chrome.runtime.sendMessage({
        action: "update-badge-source",
        badgeSource,
      });
    }
  });
