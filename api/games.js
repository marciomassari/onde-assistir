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
// Modificar a função getTodayDate para aceitar um offset de dias
function getTodayDate(dayOffset = 0) {
  // Força o uso do fuso horário de São Paulo
  const date = new Date();
  // Adiciona o offset de dias
  date.setDate(date.getDate() + dayOffset);
  
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const formattedDate = formatter.format(date);
  const [dd, mm, yyyy] = formattedDate.split('/');
  
  console.log('Data atual UTC:', new Date().toISOString());
  console.log(`Data em São Paulo (offset ${dayOffset}):`, formattedDate);
  
  return `${dd}/${mm}/${yyyy}`;
}

// Modificar a função getGamesToday para aceitar o offset
async function getGamesToday(dayOffset = 0) {
  const targetDate = getTodayDate(dayOffset);
  // Monta a URL com startDate e endDate iguais
  const url = `${GAMES_TODAY_URL}${targetDate}&endDate=${targetDate}`;
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

      // Adiciona URLs das imagens dos times
      const home_team_img = gameData.homeCompetitor?.id 
        ? `https://imagecache.365scores.com/image/upload/f_png,w_34,h_34,c_limit,q_auto:eco,dpr_2,d_Competitors:default1.png/v2/Competitors/${gameData.homeCompetitor.id}`
        : null;
      
      const away_team_img = gameData.awayCompetitor?.id 
        ? `https://imagecache.365scores.com/image/upload/f_png,w_34,h_34,c_limit,q_auto:eco,dpr_2,d_Competitors:default1.png/v2/Competitors/${gameData.awayCompetitor.id}`
        : null;

      return {
        id: gameId,
        sport: sportName,
        league: leagueName,
        home_team,
        away_team,
        home_team_img,
        away_team_img,
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
module.exports = async (req, res) => {
  // Adiciona headers CORS e tipo de conteúdo
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  try {
    console.log('Iniciando requisição /api/games');
    console.log('Ambiente:', process.env.NODE_ENV);
    console.log('TZ env:', process.env.TZ);
    
    // Obter o offset de dias da query string
    const dayOffset = parseInt(req.query.dayOffset || '0');
    
    // Limitar o offset entre -1 e 1 (ontem, hoje, amanhã)
    if (dayOffset < -1 || dayOffset > 1) {
      return res.status(400).json({ error: 'Offset de dias inválido. Use valores entre -1 e 1.' });
    }
    
    // Usar o offset como parte da chave de cache
    const cacheKey = `gamesData_${dayOffset}`;
    
    // Tenta obter os dados do cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    // Caso não esteja no cache, faça as chamadas à API:
    const gameIds = await getGamesToday(dayOffset);
    console.log(`IDs de jogos encontrados (offset ${dayOffset}):`, gameIds.length);
    
    const gameDetailsPromises = gameIds.map((id) => getGameDetails(id));
    const gamesDetails = await Promise.all(gameDetailsPromises);
    const filteredGames = gamesDetails.filter((details) => details !== null);

    // Armazena os dados no cache
    cache.set(cacheKey, filteredGames);
    res.json(filteredGames);
  } catch (error) {
    console.error('Erro na função /api/games:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar jogos.',
      message: error.message,
      timestamp: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  }
};