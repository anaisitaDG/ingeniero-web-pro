const crypto = require('crypto');

// Gravatar del correo. d=404 → si el correo no tiene foto, la imagen falla y el
// front cae a las iniciales; si tiene, muestra la foto asociada al email.
function gravatarUrl(email) {
  const hash = crypto.createHash('md5').update(String(email || '').trim().toLowerCase()).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?d=404&s=200`;
}

module.exports = { gravatarUrl };
