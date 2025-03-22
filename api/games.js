const axios = require('axios');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 }); // TTL de 1 hora (3600 segundos)

// URLs da API do 365Scores
const GAMES_TODAY_URL =
  'https://webws.365scores.com/web/games/allscores/?appTypeId=5&langId=31&timezoneName=America/Sao_Paulo&userCountryId=21&startDate=';
const GAME_DETAIL_URL =
  'https://webws.365scores.com/web/game/?appTypeId=5&langId=31&timezoneName=America/Sao_Paulo&userCountryId=21&gameId={gameId}&topBookmaker=156';

// Headers padrão para "enganar" a API de terceiros
const defaultHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/115.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.365scores.com/'
};

// Função para obter a data de hoje no formato YYYY-MM-DD
function getTodayDate() {
  // Força o uso do fuso horário de São Paulo
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const today = formatter.format(new Date());
  const [dd, mm, yyyy] = today.split('/');
  
  console.log('Data atual UTC:', new Date().toISOString());
  console.log('Data em São Paulo:', today);
  
  return `${dd}/${mm}/${yyyy}`;
}

// Função para buscar os IDs dos jogos do dia
async function getGamesToday() {
  const todayDate = getTodayDate();
  // Monta a URL com startDate e endDate iguais
  const url = `${GAMES_TODAY_URL}${todayDate}&endDate=${todayDate}`;
  try {
    const response = await axios.get(url, { headers: defaultHeaders });
    if (response.status === 200) {
      const games = response.data.games || [];
      // Extrai os gameIds
      const gameIds = games.map((game) => game.id).filter((id) => id);
      return gameIds;
    }
  } catch (error) {
    console.error('Erro ao buscar jogos de hoje:', error.message);
  }
  return [];
}

// Função para buscar os detalhes de um jogo específico
async function getGameDetails(gameId) {
  try {
    const url = GAME_DETAIL_URL.replace('{gameId}', gameId);
    const response = await axios.get(url, {
      headers: defaultHeaders
    });
    if (response.status === 200) {
      const gameData = response.data.game || {};

      // Nome do esporte (supondo que "sports" seja um array na resposta)
      const sportsData = response.data || {};
      let sportName = 'Esporte Desconhecido';
      if (Array.isArray(sportsData.sports) && sportsData.sports.length > 0) {
        sportName = sportsData.sports[0].name || 'Esporte Desconhecido';
      }

      // Nome do campeonato/liga
      const leagueName = gameData.competitionDisplayName || 'Liga Desconhecida';

      // Nome dos times
      const home_team =
        (gameData.homeCompetitor && gameData.homeCompetitor.name) || 'Time A';
      const away_team =
        (gameData.awayCompetitor && gameData.awayCompetitor.name) || 'Time B';

      // Hora do jogo
      let start_time = 'Indisponível';
      const start_time_raw = gameData.startTime || 'Indisponível';
      if (start_time_raw !== 'Indisponível') {
        try {
          const dt = new Date(start_time_raw);
          // Converte para o horário de "America/Sao_Paulo"
          start_time = dt.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo'
          });
        } catch (error) {
          start_time = 'Formato inválido';
        }
      }

      // Transmissão
      let tv_networks = 'Indisponível';
      if (
        gameData.tvNetworks &&
        Array.isArray(gameData.tvNetworks) &&
        gameData.tvNetworks.length > 0
      ) {
        tv_networks = gameData.tvNetworks.map((tv) => tv.name).join(', ');
      }

      return {
        id: gameId,
        sport: sportName,
        league: leagueName,
        home_team,
        away_team,
        start_time,
        tv_networks
      };
    }
  } catch (error) {
    console.error(`Erro ao buscar detalhes do jogo ${gameId}:`, error.message);
  }
  return null;
}

// Função serverless que responde à requisição GET em /api/games
// Na função principal, adicionar mais logs
module.exports = async (req, res) => {
  try {
    console.log('Iniciando requisição /api/games');
    console.log('Ambiente:', process.env.NODE_ENV);
    console.log('TZ env:', process.env.TZ);
    console.log('Sistema TZ:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('Data/Hora atual:', new Date().toISOString());
    console.log('Data/Hora SP:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    // Tenta obter os dados do cache
    const cachedData = cache.get('gamesData');
    if (cachedData) {
      return res.json(cachedData);
    }

    // Caso não esteja no cache, faça as chamadas à API:
    const gameIds = await getGamesToday();
    console.log('IDs de jogos encontrados:', gameIds.length);
    const gameDetailsPromises = gameIds.map((id) => getGameDetails(id));
    const gamesDetails = await Promise.all(gameDetailsPromises);
    const filteredGames = gamesDetails.filter((details) => details !== null);

    // Armazena os dados no cache
    cache.set('gamesData', filteredGames);
    res.json(filteredGames);
  } catch (error) {
    console.error('Erro na função /api/games:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar jogos.',
      timestamp: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  }
};