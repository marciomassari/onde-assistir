// src/components/ShareButtonMedium.js
import React, { useState } from 'react';
import './ShareButtonMedium.css';
import { FiShare2, FiCopy, FiX } from 'react-icons/fi';
import { FaTwitter, FaWhatsapp } from 'react-icons/fa';

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Mobi|Android/i.test(navigator.userAgent);
}

const ShareButtonMedium = ({ title, url }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const isMobile = isMobileDevice();

  const handleClick = async () => {
    if (isMobile && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch (error) {
        console.error("Erro no Web Share API:", error);
        // Se ocorrer erro, não exibe fallback no mobile
      }
    } else {
      setModalOpen(true);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(title + ' ' + url);
      console.log("Link copiado para a área de transferência!");
      setModalOpen(false);
    } catch (error) {
      console.error("Erro ao copiar link:", error);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  return (
    <>
      <button className="share-button-medium" onClick={handleClick}>
        <FiShare2 size={20} />
      </button>
      {modalOpen && (
        <div className="share-modal-overlay" onClick={closeModal}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={closeModal}>
              <FiX size={20} />
            </button>
            <h4>Compartilhar</h4>
            <button className="modal-button" onClick={handleCopyLink}>
              <FiCopy size={18} className="dropdown-icon" /> Copiar link
            </button>
            <a
              className="modal-button"
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaTwitter size={18} className="dropdown-icon" /> Twitter
            </a>
            <a
              className="modal-button"
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(title + ' ' + url)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp size={18} className="dropdown-icon" /> WhatsApp
            </a>
          </div>
        </div>
      )}
    </>
  );
};

export default ShareButtonMedium;
