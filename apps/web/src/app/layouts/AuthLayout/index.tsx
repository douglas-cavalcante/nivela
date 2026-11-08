import { Box, Card, CardContent, Typography } from '@mui/material';
import { Outlet } from 'react-router';
import { Mascot } from 'src/components/Mascot';

/** Moldura das telas públicas (login etc.): uma folha avulsa no centro do caderno. */
export function AuthLayout() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 3 }}>
            <Mascot size={56} />
            <Typography variant="h2" component="p">
              Nivela
            </Typography>
          </Box>
          <Outlet />
        </CardContent>
      </Card>
    </Box>
  );
}
