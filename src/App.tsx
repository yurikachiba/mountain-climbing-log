import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Import } from './pages/Import';
import { Random } from './pages/Random';
import { Fragments } from './pages/Fragments';
import { Timeline } from './pages/Timeline';
import { Settings } from './pages/Settings';
import { Analysis } from './pages/Analysis';
import { OnThisDay } from './pages/OnThisDay';
import { Search } from './pages/Search';
import { Calendar } from './pages/Calendar';
import { WordCloud } from './pages/WordCloud';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';
import { Sitemap } from './pages/Sitemap';
import { Landing } from './pages/Landing';
import { AiLogs } from './pages/AiLogs';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Nav />
        <main className="main">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Home />} />
            <Route path="/import" element={<Import />} />
            <Route path="/random" element={<Random />} />
            <Route path="/onthisday" element={<OnThisDay />} />
            <Route path="/search" element={<Search />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/fragments" element={<Fragments />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/wordcloud" element={<WordCloud />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/ai-logs" element={<AiLogs />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/sitemap" element={<Sitemap />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
