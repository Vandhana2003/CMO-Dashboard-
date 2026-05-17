import React, { useState } from 'react';
import InfoCenter from '../../components/InfoCenter';

export default function InfoPage() {
  return (
    <div className="page">
      <div className="page-header"><h1 className="page-title">Info Centre</h1><p className="page-subtitle">Understand all parameters and metrics used in the dashboard</p></div>
      <InfoCenter inline />
    </div>
  );
}
