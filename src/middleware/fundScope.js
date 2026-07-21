/**
 * Ensure the authenticated Flora user has a fund in scope, and pin the
 * request to it. Every En Garde proxy request is bound to exactly one fund's
 * connection (US-6.1.1) — a GP/Admin cannot read another fund's En Garde
 * data because the fund comes from their own signed Flora JWT, not from a
 * client-supplied parameter.
 *
 * For a Founder (portfolio_company, US-6.1.2) we additionally require a
 * companyId and pin the request to it, so a founder is scoped to their own
 * portfolio company within the fund — never sibling companies.
 *
 * Must run after floraAuth (which populates req.floraUser).
 */
function requireFundScope(req, res, next) {
  const user = req.floraUser || {};
  const fundId = user.fundId;
  if (!fundId) {
    return res.status(400).json({ success: false, error: 'No fund in scope for this user' });
  }

  if (user.role === 'portfolio_company' && !user.companyId) {
    return res.status(400).json({ success: false, error: 'No portfolio company in scope for this founder' });
  }

  req.fundId = fundId;
  req.companyId = user.companyId || null;
  return next();
}

module.exports = requireFundScope;
