import React, { useEffect, useState, useMemo } from 'react';
import './GamesList.css';
import logo from './logo.png';
import SkeletonLoader from './components/SkeletonLoader';
import ShareButtonMedium from './components/ShareButtonMedium';
import SwitchToggle from './components/SwitchToggle';
// Adicionar ícones para navegação
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

function GamesList() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  // Adicionar estado para controlar o dia selecionado
  const [selectedDay, setSelectedDay] = useState(0); // 0 = hoje, -1 = ontem, 1 = amanhã

  // Estado unificado para o filtro global (campo único de busca)
  const [searchQuery, setSearchQuery] = useState("");

  // Estado para exibir todos os jogos (mesmo sem transmissão)
  const [showAllGames, setShowAllGames] = useState(false);

  // Novo estado: para exibir jogos que já iniciaram
  const [showStartedGames, setShowStartedGames] = useState(false);

  // Estado para a aba ativa (esporte) – usado quando searchQuery estiver vazio
  const [activeSport, setActiveSport] = useState("");

  // Estado para armazenar se cada campeonato está recolhido ou não
  const [collapsedLeagues, setCollapsedLeagues] = useState({});

  // Estado para armazenar o id do jogo selecionado via URL (se houver)
  const [selectedGameId, setSelectedGameId] = useState(null);

  // Adicionar um cache para armazenar os dados de cada dia
  const [gamesCache, setGamesCache] = useState({
    '-1': null, // ontem
    '0': null,  // hoje
    '1': null   // amanhã
  });

  // Função para obter o texto do dia selecionado
  const getDayText = () => {
    switch (selectedDay) {
      case -1:
        return "Jogos de Ontem";
      case 1:
        return "Jogos de Amanhã";
      default:
        return "Jogos de Hoje";
    }
  };

  // Função para obter a data formatada
  const getFormattedDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + selectedDay);
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  };

  // Função para formatar a visualização da hora (apenas hh:mm)
  const formatTime = (startTime) => {
    if (startTime.toLowerCase() === 'indisponível') return startTime;
    const parts = startTime.split(' ');
    if (parts.length >= 2) {
      const timeParts = parts[1].split(':');
      if (timeParts.length >= 2) return `${timeParts[0]}:${timeParts[1]}`;
    }
    return startTime;
  };

  // Efeito para ler os parâmetros "q" e "game" da URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setSearchQuery(q);
    const gameParam = params.get('game');
    if (gameParam) setSelectedGameId(gameParam);
  }, []);

  // Busca os dados do backend
  useEffect(() => {
    // Se já temos os dados no cache, use-os
    if (gamesCache[selectedDay]) {
      setGames(gamesCache[selectedDay]);
      
      // Se não temos um esporte ativo, defina um
      if (!activeSport && gamesCache[selectedDay].length > 0) {
        const sports = [...new Set(gamesCache[selectedDay].map(game => game.sport || 'Esporte Desconhecido'))];
        if (sports.length > 0 && !sports.includes(activeSport)) {
          setActiveSport(sports[0]);
        }
      }
      
      return; // Não precisamos buscar novamente
    }
    
    // Se não temos os dados no cache, mostre o loading e busque-os
    setLoading(true);
    
    fetch(`/api/games?dayOffset=${selectedDay}`)
      .then(response => response.json())
      .then(data => {
        // Atualizar o cache
        setGamesCache(prev => ({
          ...prev,
          [selectedDay]: data
        }));
        
        setGames(data);
        setLoading(false);
        
        // Se não temos um esporte ativo ou se o esporte ativo não existe nos novos dados,
        // só então definimos um novo esporte ativo
        if (data.length > 0 && (!activeSport || !data.some(game => game.sport === activeSport))) {
          const sports = [...new Set(data.map(game => game.sport || 'Esporte Desconhecido'))];
          if (sports.length > 0) setActiveSport(sports[0]);
        }
      })
      .catch(error => {
        console.error('Erro ao buscar os dados:', error);
        setLoading(false);
      });
  }, [selectedDay, activeSport, gamesCache]);

  // Modificar a função de troca de dia para ser mais suave
  const changeDay = (newDay) => {
    // Se já temos os dados no cache, não mostramos o loading
    if (gamesCache[newDay]) {
      setSelectedDay(newDay);
    } else {
      // Se não temos os dados, mostramos o loading e mudamos o dia
      setLoading(true);
      setSelectedDay(newDay);
    }
  };

  // Se um jogo foi selecionado via URL, encontre-o na lista
  const selectedGame = useMemo(() => {
    if (!selectedGameId) return null;
    return games.find(game => String(game.id) === String(selectedGameId));
  }, [games, selectedGameId]);

  // Agrupa os jogos aplicando os filtros (global e de transmissão/horário)
  const groupedGamesForFilter = useMemo(() => {
    return games.reduce((acc, game) => {
      const sport = game.sport || 'Esporte Desconhecido';
      const league = game.league || 'Liga Desconhecida';
      
      // Se searchQuery estiver preenchido, aplica o filtro global (em todos os campos)
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const leagueMatch = game.league.toLowerCase().includes(query);
        const teamMatch = game.home_team.toLowerCase().includes(query) ||
                          game.away_team.toLowerCase().includes(query);
        let timeMatch = false;
        const timeString = game.start_time.toLowerCase();
        if (timeString !== 'indisponível') {
          const parts = game.start_time.split(' ');
          if (parts.length >= 2) {
            const hourPart = parts[1].split(':').slice(0, 2).join(':');
            timeMatch = hourPart.includes(query);
          }
        }
        if (!(leagueMatch || teamMatch || timeMatch)) return acc;
      }
      
      // Verifica se o jogo já iniciou
      let includeGame = true;
      const timeString = game.start_time.toLowerCase();
      if (timeString !== 'indisponível') {
        const parts = game.start_time.split(' ');
        if (parts.length >= 2) {
          const [datePart, timePart] = parts;
          const [day, month, year] = datePart.split('/');
          const [hour, minute] = timePart.split(':');
          const gameDate = new Date(
            parseInt(year, 10),
            parseInt(month, 10) - 1,
            parseInt(day, 10),
            parseInt(hour, 10),
            parseInt(minute, 10)
          );
          // Se o jogo já começou e o usuário não deseja vê-lo, não inclui
          if (gameDate < new Date() && !showStartedGames) {
            includeGame = false;
          }
        }
      }
      if (!includeGame) return acc;
      
      // Filtro de transmissão
      const transmissionMatch = showAllGames ? true : game.tv_networks.toLowerCase() !== 'indisponível';
      if (!transmissionMatch) return acc;
      
      // Agrupa o jogo
      if (!acc[sport]) acc[sport] = {};
      if (!acc[sport][league]) acc[sport][league] = [];
      acc[sport][league].push(game);
      return acc;
    }, {});
  }, [games, searchQuery, showAllGames, showStartedGames]);

  // O menu de esportes: com ordem fixa para os esportes mais comuns
  const sportsTabs = useMemo(() => {
  // Definir a ordem fixa dos esportes mais comuns
  const sportsOrder = [
  'Futebol', 
  'Basquete', 
  'Vôlei', 
  'Tênis', 
  'Fórmula 1',
  'UFC'
  ];
  
  // Obter todos os esportes disponíveis nos dados
  const availableSports = [...new Set(games.map(game => game.sport || 'Esporte Desconhecido'))];
  
  // Filtrar os esportes na ordem definida (apenas os que existem nos dados)
  const orderedSports = sportsOrder.filter(sport => availableSports.includes(sport));
  
  // Adicionar os esportes restantes que não estão na lista fixa
  const remainingSports = availableSports.filter(sport => !sportsOrder.includes(sport));
  
  // Retornar a lista completa: primeiro os esportes na ordem fixa, depois os restantes
  return [...orderedSports, ...remainingSports];
  }, [games]);

  // Se searchQuery estiver preenchido, exibe os jogos globalmente; senão, filtra apenas os da aba ativa.
  const filteredGamesForDisplay = useMemo(() => {
    if (searchQuery.trim() !== "") {
      return groupedGamesForFilter;
    } else {
      return { [activeSport]: groupedGamesForFilter[activeSport] || {} };
    }
  }, [groupedGamesForFilter, searchQuery, activeSport]);

  // Lista de campeonatos para exibição
  const filteredLeagueKeys = useMemo(() => {
    let leagues = [];
    Object.keys(filteredGamesForDisplay).forEach(sport => {
      leagues = leagues.concat(Object.keys(filteredGamesForDisplay[sport]));
    });
    return leagues;
  }, [filteredGamesForDisplay]);

  // Função para alternar o estado de recolhimento de um campeonato
  const toggleLeagueCollapse = (sport, league) => {
    const key = `${sport}-${league}`;
    setCollapsedLeagues(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return <SkeletonLoader />;
  }

  // Se um jogo foi selecionado via URL, exibe apenas esse jogo
  if (selectedGame) {
    const gameShareUrl = `${window.location.origin}/?game=${selectedGame.id}`;
    const shareText = `${selectedGame.home_team} vs ${selectedGame.away_team}` +
      (selectedGame.tv_networks.toLowerCase() !== 'indisponível' ? ` - Transmissão: ${selectedGame.tv_networks}` : "");
    return (
      <div className="site-container">
        <header className="site-header">
          <div className="header-logo-container">
            <a href="/" className="header-logo-link">
              <img src={logo} alt="Logo" className="header-logo" />
            </a>
          </div>
        </header>
        <main className="content">
          <div className="games-list">
            <div className="league-block">
              <h3 className="league-title">{selectedGame.sport} - {selectedGame.league}</h3>
              <div className="game-row">
                <div className="game-info-wrapper">
                  <div className="teams-row">
                    <span className="home-team">
                      {selectedGame.home_team_img && (
                        <img 
                          src={selectedGame.home_team_img} 
                          alt={selectedGame.home_team}
                          className="team-logo"
                        />
                      )}
                      {selectedGame.home_team}
                    </span>
                    <span className="start-time">{formatTime(selectedGame.start_time)}</span>
                    <span className="away-team">
                      {selectedGame.away_team}
                      {selectedGame.away_team_img && (
                        <img 
                          src={selectedGame.away_team_img} 
                          alt={selectedGame.away_team}
                          className="team-logo"
                        />
                      )}
                    </span>
                  </div>
                  <div className="tv-networks">{selectedGame.tv_networks}</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="site-container">
      <header className="site-header">
        <div className="header-logo-container">
          <img src={logo} alt="Logo" className="header-logo" />
        </div>
      </header>
      <nav className="sports-menu">
        {sportsTabs.map(sport => (
          <span
            key={sport}
            className={`sports-menu-item ${sport === activeSport ? "active" : ""}`}
            onClick={() => setActiveSport(sport)}
          >
            {sport}
          </span>
        ))}
      </nav>
      
      {/* Adicionar navegação entre dias */}
      <div className="day-navigation">
        <button 
          className="day-nav-button"
          onClick={() => changeDay(Math.max(selectedDay - 1, -1))}
          disabled={selectedDay === -1}
        >
          <FiChevronLeft size={20} />
        </button>
        <div className="day-title-container">
          <h3 className="day-title">{getDayText()}</h3>
          <span className="day-date">{getFormattedDate()}</span>
        </div>
        <button 
          className="day-nav-button"
          onClick={() => changeDay(Math.min(selectedDay + 1, 1))}
          disabled={selectedDay === 1}
        >
          <FiChevronRight size={20} />
        </button>
      </div>
      
      <main className="content">
        <div className="filter-section">
          <input
            type="text"
            placeholder="Buscar por campeonato, time ou horário..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="switch-wrapper">
            <SwitchToggle
              checked={showAllGames}
              onChange={(e) => setShowAllGames(e.target.checked)}
              label={showAllGames ? "Jogos sem transmissão" : "Jogos sem transmissão"}
            />
            <SwitchToggle
              checked={showStartedGames}
              onChange={(e) => setShowStartedGames(e.target.checked)}
              label={showStartedGames ? "Jogos iniciados" : "Jogos iniciados"}
            />
          </div>
        </div>

        <div className="games-list">
          {filteredLeagueKeys.length === 0 ? (
            <p>Nenhum jogo encontrado com os filtros aplicados.</p>
          ) : (
            Object.keys(filteredGamesForDisplay).map(sport => (
              Object.keys(filteredGamesForDisplay[sport]).map(league => {
                const key = `${sport}-${league}`;
                const isCollapsed = collapsedLeagues[key] || false;
                return (
                  <div key={league} className="league-block">
                    <h3
                      className="league-title"
                      onClick={() => toggleLeagueCollapse(sport, league)}
                    >
                      {league} <span className="collapse-indicator">{isCollapsed ? "+" : "-"}</span>
                    </h3>
                    {!isCollapsed &&
                      filteredGamesForDisplay[sport][league].map((game, index) => {
                        const gameShareUrl = `${window.location.origin}/?game=${game.id}`;
                        const shareText = `${game.home_team} vs ${game.away_team}` +
                          (game.tv_networks.toLowerCase() !== 'indisponível' ? ` - Transmissão: ${game.tv_networks}` : "");
                        return (
                          <div key={index} className="game-row">
                            <div className="game-info-wrapper">
                              <div className="teams-row">
                                <span className="home-team">
                                  {game.home_team_img && (
                                    <img 
                                      src={game.home_team_img} 
                                      alt={game.home_team}
                                      className="team-logo"
                                    />
                                  )}
                                  {game.home_team}
                                </span>
                                <span className="start-time">{formatTime(game.start_time)}</span>
                                <span className="away-team">
                                  {game.away_team}
                                  {game.away_team_img && (
                                    <img 
                                      src={game.away_team_img} 
                                      alt={game.away_team}
                                      className="team-logo"
                                    />
                                  )}
                                </span>
                              </div>
                              <div className="tv-networks">{game.tv_networks}</div>
                            </div>
                            <div className="share-button-wrapper">
                              <ShareButtonMedium title={shareText} url={gameShareUrl} />
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                );
              })
            ))
          )}
        </div>
      </main>
    </div>
  );
}

export default GamesList;
