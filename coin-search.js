const axios = require('axios');

// Search coins on CoinGecko
const searchCoins = async (query) => {
  try {
    const response = await axios.get(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`);
    return response.data.coins.slice(0, 20); // Return top 20 results
  } catch (error) {
    console.error('Error searching coins:', error.message);
    throw new Error('Error searching coins');
  }
};

// Get coin price from CoinGecko
const getCoinPrice = async (coinId) => {
  try {
    const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
    return response.data[coinId]?.usd;
  } catch (error) {
    console.error('Error fetching coin price:', error.message);
    throw new Error('Error fetching coin price');
  }
};

module.exports = { searchCoins, getCoinPrice };
