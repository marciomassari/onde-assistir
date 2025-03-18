import React from 'react';
import './SkeletonLoader.css';

const SkeletonLoader = () => {
  return (
    <div className="skeleton-container">
      {/* Cabeçalho placeholder */}
      <div className="skeleton-header"></div>

      {/* Filtros placeholder */}
      <div className="skeleton-filters">
        <div className="skeleton-filter"></div>
        <div className="skeleton-filter"></div>
        <div className="skeleton-filter"></div>
      </div>

      {/* Lista de jogos placeholder */}
      <div className="skeleton-game-list">
        {Array(3)
          .fill(0)
          .map((_, leagueIndex) => (
            <div key={leagueIndex} className="skeleton-league">
              <div className="skeleton-league-title"></div>
              {Array(4)
                .fill(0)
                .map((_, gameIndex) => (
                  <div key={gameIndex} className="skeleton-game-row">
                    <div className="skeleton-team skeleton-team-left"></div>
                    <div className="skeleton-time"></div>
                    <div className="skeleton-team skeleton-team-right"></div>
                  </div>
                ))}
            </div>
          ))}
      </div>
    </div>
  );
};

export default SkeletonLoader;
