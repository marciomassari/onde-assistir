import React, { useEffect, useState, useMemo } from 'react';
import './GamesList.css';
import logo from './logo.png';
import SkeletonLoader from './components/SkeletonLoader';

function GamesList() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado unificado para a busca global
  const [searchQuery, setSearchQuery] = useState("");

  // Estado para exibir todos os jogos (mesmo sem transmissão)
  const [showAllGames, setShowAllGames] = useState(false);

  // Estado para a aba ativa (esporte)
  const [activeSport, setActiveSport] = useState("");

  // Estado para armazenar se cada campeonato está recolhido ou não
  // A chave será uma string composta por "sport-league"
  const [collapsedLeagues, setCollapsedLeagues] = useState({});

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

  // Efeito para ler o parâmetro "q" da URL e definir o searchQuery
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setSearchQuery(q);
  }, []);

  // Busca os dados do backend
  useEffect(() => {
    fetch('/api/games')
      .then((response) => response.json())
      .then((data) => {
        setGames(data);
        setLoading(false);
        if (data.length > 0) {
          const sports = [...new Set(data.map((game) => game.sport))];
          if (sports.length > 0) setActiveSport(sports[0]);
        }
      })
      .catch((error) => {
        console.error('Erro ao buscar os dados:', error);
        setLoading(false);
      });
  }, []);

  // Agrupa os jogos por esporte e por campeonato (liga)
  const groupedGames = useMemo(() => {
    return games.reduce((acc, game) => {
      const sport = game.sport || 'Esporte Desconhecido';
      const league = game.league || 'Liga Desconhecida';
      if (!acc[sport]) acc[sport] = {};
      if (!acc[sport][league]) acc[sport][league] = [];
      acc[sport][league].push(game);
      return acc;
    }, {});
  }, [games]);

  // Aplica os filtros aos jogos do esporte ativo
  const filteredGames = useMemo(() => {
    const sportGames = groupedGames[activeSport] || {};
    const filtered = {};
    Object.keys(sportGames).forEach((league) => {
      filtered[league] = sportGames[league].filter((game) => {
        // Verifica se o jogo ainda não passou
        let isFuture = true;
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
            isFuture = gameDate >= new Date();
          }
        }
        // Filtro de transmissão
        const transmissionMatch =
          showAllGames ? true : game.tv_networks.toLowerCase() !== 'indisponível';

        // Se o searchQuery estiver preenchido, filtra nos três campos
        if (searchQuery.trim() !== "") {
          const query = searchQuery.toLowerCase();
          const leagueMatch = game.league.toLowerCase().includes(query);
          const teamMatch =
            game.home_team.toLowerCase().includes(query) ||
            game.away_team.toLowerCase().includes(query);
          let timeMatch = false;
          if (timeString !== 'indisponível') {
            const parts = game.start_time.split(' ');
            if (parts.length >= 2) {
              // Considera apenas hh:mm para a filtragem
              const hourPart = parts[1].split(':').slice(0, 2).join(':');
              timeMatch = hourPart.includes(query);
            }
          }
          return (leagueMatch || teamMatch || timeMatch) && isFuture && transmissionMatch;
        } else {
          // Se searchQuery estiver vazio, retorna os jogos que ainda não passaram e atendem à transmissão
          return isFuture && transmissionMatch;
        }
      });
    });
    return filtered;
  }, [activeSport, groupedGames, showAllGames, searchQuery]);

  // Lista de abas (nomes dos esportes)
  const sportsTabs = useMemo(() => Object.keys(groupedGames), [groupedGames]);

  // Filtra apenas as ligas que possuem resultados após os filtros
  const filteredLeagueKeys = useMemo(() => {
    return Object.keys(filteredGames).filter(
      (league) => filteredGames[league].length > 0
    );
  }, [filteredGames]);

  // Função para alternar o estado de recolhimento de um campeonato
  const toggleLeagueCollapse = (sport, league) => {
    const key = `${sport}-${league}`;
    setCollapsedLeagues((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return <SkeletonLoader />;
  }

  return (
    <div className="site-container">
      {/* Header com logo */}
      <header className="site-header">
        <div className="header-logo-container">
          <img src={logo} alt="Logo" className="header-logo" />
        </div>
      </header>

      {/* Menu de categorias (esportes) */}
      <nav className="sports-menu">
        {sportsTabs.map((sport) => (
          <span
            key={sport}
            className={`sports-menu-item ${sport === activeSport ? "active" : ""}`}
            onClick={() => setActiveSport(sport)}
          >
            {sport}
          </span>
        ))}
      </nav>

      {/* Conteúdo principal com filtros e resultados */}
      <main className="content">
        {/* Seção de Filtros */}
        <div className="filter-section">
          <input
            type="text"
            placeholder="Buscar por campeonato, time ou horário..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className="transmission-toggle"
            onClick={() => setShowAllGames(!showAllGames)}
          >
            {showAllGames
              ? "Mostrar somente jogos com transmissão"
              : "Incluir jogos sem transmissão"}
          </button>
        </div>

        {/* Lista de Campeonatos e Jogos Filtrados */}
        <div className="games-list">
          {filteredLeagueKeys.length === 0 ? (
            <p>Nenhum jogo encontrado com os filtros aplicados.</p>
          ) : (
            filteredLeagueKeys.map((league) => {
              const key = `${activeSport}-${league}`;
              const isCollapsed = collapsedLeagues[key] || false;
              return (
                <div key={league} className="league-block">
                  <h3
                    className="league-title"
                    onClick={() => toggleLeagueCollapse(activeSport, league)}
                  >
                    {league} <span className="collapse-indicator">{isCollapsed ? "+" : "-"}</span>
                  </h3>
                  {!isCollapsed &&
                    filteredGames[league].map((game, index) => (
                      <div key={index} className="game-row">
                        <div className="teams-row">
                          <span className="home-team">{game.home_team}</span>
                          <span className="start-time">{formatTime(game.start_time)}</span>
                          <span className="away-team">{game.away_team}</span>
                        </div>
                        <div className="tv-networks">{game.tv_networks}</div>
                      </div>
                    ))}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

export default GamesList;