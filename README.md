# Programa de Segurança Hídrica - WebGIS Interativo

Sistema de visualização geoespacial para análise territorial do Programa de Segurança Hídrica do IDR-Paraná.

## 📋 Visão Geral

Este projeto oferece duas interfaces complementares:

1. **WebGIS Estático** (`index.html`) - Interface HTML/JS pura, otimizada para visualização rápida com filtros por microbacia
2. **Dashboard Streamlit** (`app.py`) - Interface Python com análises avançadas e indicadores

## 🚀 Início Rápido

### WebGIS Estático

Simplesmente abra o arquivo `index.html` em um navegador web moderno. Não requer instalação.

```bash
# Opção 1: Abrir diretamente
start index.html  # Windows
open index.html   # macOS
xdg-open index.html  # Linux

# Opção 2: Servidor local
python -m http.server 8000
# Acesse: http://localhost:8000
```

### Dashboard Streamlit

```bash
# Instalar dependências
pip install -r requirements.txt

# Executar aplicação
streamlit run app.py
```

## 🗺️ Funcionalidades do WebGIS

### Camadas Disponíveis

- **Microbacias (PSH)** - Delimitação das microbacias do programa
- **Uso do Solo (Ottobacias)** - Classificação detalhada do uso e cobertura do solo
- **Conflito de Uso** - Análise de conflitos de uso em Áreas de Preservação Permanente
- **Declividade (Classes %)** - Distribuição das classes de declividade por ottobacia
- **Curvas de Nível** - Visualização das curvas de nível para análise topográfica

### Filtros Inteligentes

- **Filtro por Microbacia** - Painel lateral com busca e seleção múltipla
- **Busca Textual** - Filtrar por ID, bacia ou manancial
- **Seleção Rápida** - Botões para selecionar todas ou limpar seleção

### Controles de Visualização

- **Opacidade** - Slider para ajustar transparência das camadas
- **Ajustar Visão** - Botão para enquadrar automaticamente
- **Camadas Base** - CARTO Light, OSM Padrão, Esri Imagery
- **Legenda Dinâmica** - Atualiza automaticamente conforme camadas ativas

### Legendas Automáticas

O sistema calcula e exibe automaticamente:
- **Áreas por classe** - Com hectares e percentuais
- **Área total** - Por camada selecionada
- **Contagem de feições** - Número de polígonos

## 📁 Estrutura de Dados

```
data/
├── microbacias_selecionadas__microbacias.geojson_part-*.gz
├── uso_solo__usodosolo_otto.geojson_part-*.gz
└── conflitosdeuso__uso_solo_em_app.geojson_part-*.gz
```

### Formato dos Arquivos

- **Formato**: GeoJSON compactado (.gz)
- **Codificação**: UTF-8
- **Sistema de Coordenadas**: Preserva CRS original dos dados
- **Campos obrigatórios**:
  - `ID` - Identificador único da microbacia/ottobacia
  - `area_ha` - Área em hectares
  - Para uso do solo: `Nivel_II` ou `Nivel_I`

## 🛠️ Tecnologias Utilizadas

### WebGIS Estático
- **Leaflet 1.9.4** - Biblioteca de mapas interativos
- **Turf.js 6.5.0** - Análise espacial e cálculos geométricos
- **Pako 2.1.0** - Descompactação de arquivos .gz
- **Vanilla JavaScript** - Sem frameworks, máxima performance

### Dashboard Streamlit
- **Streamlit** - Framework para aplicações web
- **Folium** - Mapas interativos integrados
- **GeoPandas** - Manipulação de dados geoespaciais
- **Plotly** - Visualizações interativas

## 🎨 Personalização

### Cores de Uso do Solo

As cores são definidas no arquivo `script.js`:

```javascript
const USO_COLORS = {
  'Agricultura Anual': '#e6ab02',
  'Floresta Nativa': '#1b9e77',
  'Pastagem/Campo': '#a6d854',
  // ... adicione mais conforme necessário
};
```

### Estilos de Camadas

Ajuste opacidade, espessura de linhas e cores base em `script.js`:

```javascript
case 'microbacias':
  return {
    color: '#2c3e50',      // Cor da borda
    weight: 1.0,           // Espessura da linha
    fillColor: '#3498db',  // Cor de preenchimento
    fillOpacity: 0.45 * opacity,
    opacity
  };
```

## 📊 Modelo de Dados

### Campos Reconhecidos

O sistema identifica automaticamente estes campos:

**Identificação**:
- `ID`, `id`, `Cod_otto`, `COD_OTTO`

**Microbacias**:
- `Bacia`, `BACIA`, `Microbacias_Bacia`
- `Manancial`, `MANANCIAL`, `Microbacias_Manancial`

**Uso do Solo**:
- `Nivel_II`, `NIVEL_II` (preferencial)
- `Nivel_I`, `NIVEL_I` (fallback)

**Área**:
- `area_ha` (hectares)

## 🚀 Deployment

### Servidor Local

```bash
# Python HTTP Server
python -m http.server 8000

# Node.js HTTP Server
npx http-server -p 8000

# PHP Built-in Server
php -S localhost:8000
```

### Hospedagem Web

Compatível com:
- GitHub Pages
- Netlify
- Vercel
- Qualquer hospedagem de arquivos estáticos

**Nota**: Certifique-se de que o servidor suporta arquivos `.gz` e envia o header `Content-Type` correto.

## 📝 Licença

IDR-Paraná © 2025 - Programa de Segurança Hídrica

## 🤝 Contribuindo

Para contribuir com melhorias:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📞 Suporte

Para dúvidas ou problemas técnicos, entre em contato com a equipe de TI do IDR-Paraná.

## 🔄 Changelog

### v1.0 (2025-01)
- Interface WebGIS implementada
- Sistema de filtros por microbacia
- Legendas dinâmicas automáticas
- Suporte a múltiplas camadas simultâneas
- Controle de opacidade e visualização
- Base de código otimizada do projeto Água Segura
