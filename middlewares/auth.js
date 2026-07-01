function ensureAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  return next();
}

function ensureAdmin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  if (req.session.user.role !== 'admin') {
    return res.status(403).render('login', {
      title: 'Acesso restrito',
      error: 'Somente administradores podem alterar os dados.',
      lastUsername: req.session.user.username,
    });
  }

  return next();
}

module.exports = {
  ensureAdmin,
  ensureAuthenticated,
};
