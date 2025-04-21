'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n-client';
import BounceCards from '@/components/ui/Components/BounceCards/BounceCards';
import CompanyCard from '@/components/ui/Components/BounceCards/CompanyCard';
import { RecommendationResult } from '@/lib/openai/client';
import { Button } from '../ui/button';
import {
  trackSignupClick,
  trackEvent,
  trackEmailSignupClick,
  trackGoogleSignupClick,
} from '@/lib/analytics';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useRouter } from 'next/navigation';
import { BASE_URL } from '@/lib/constants/domain';
import { LOCALSTORAGE_KEYS } from '@/lib/constants/localStorage';

// Extend the RecommendationResult type to include the feedback property
interface ExtendedRecommendationResult extends RecommendationResult {
  feedback?: 'interested' | 'not_interested';
}

interface SignupDialogProps {
  open: boolean;
  onClose: () => void;
  lng: string;
  recommendations: ExtendedRecommendationResult[];
  showInPage?: boolean;
  showRevealedOnly?: boolean;
}

const SignupDialog: React.FC<SignupDialogProps> = ({
  open,
  onClose,
  lng,
  recommendations,
  showInPage = false,
  showRevealedOnly = false,
}) => {
  const { t } = useTranslation(lng, 'ai');
  const isMobile = useIsMobile();
  const router = useRouter();
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Check if we're in a browser environment before accessing localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedValue = localStorage.getItem(LOCALSTORAGE_KEYS.ANONYMOUS_COMPANIES);
      setIsAnonymous(storedValue === 'true');
    }
  }, []);

  // Create company cards for the first 5 recommendations
  // If showRevealedOnly is true, only show companies with feedback
  const filteredRecommendations = showRevealedOnly
    ? recommendations.filter((rec) => rec.feedback)
    : recommendations;

  const companyCards = filteredRecommendations
    .slice(0, 5)
    .map((rec) => (
      <CompanyCard
        key={rec.id || rec.company.id}
        name={rec.company.name}
        logoUrl={rec.company.logo_url}
        shouldAnonymize={!rec.feedback && isAnonymous}
      />
    ))
    .reverse();

  // Handle sign up button click with tracking
  const handleSignupClick = async () => {
    setIsRedirecting(true);
    try {
      // Track email signup click
      await trackEmailSignupClick();

      // Also track the legacy signup click event
      await trackSignupClick('signup_dialog', {
        dialog_type: showInPage ? 'in_page' : 'modal',
        revealed_companies: filteredRecommendations.filter((rec) => rec.feedback).length,
        total_companies: recommendations.length,
      });
    } catch (error) {
      console.error('Error tracking signup click:', error);
    }

    // Get current URL search params
    const currentUrl = new URL(window.location.href);
    const searchParams = new URLSearchParams(currentUrl.search);

    // Remove userId and locale params if they exist
    searchParams.delete('userId');
    searchParams.delete('locale');

    // Generate the query string
    const queryString = searchParams.toString();
    const queryPrefix = queryString ? '?' : '';

    // Navigate to signup page with preserved query params
    router.push(`${BASE_URL}/auth/students/signup${queryPrefix}${queryString}`);
  };

  // Handle Google signup click
  // const handleGoogleSignupClick = async () => {
  //   try {
  //     await trackGoogleSignupClick();
  //   } catch (error) {
  //     console.error("Error tracking Google signup click:", error);
  //   }
  // };

  // Handle dialog close with tracking
  const handleDialogClose = () => {
    // Only track dismissal if not in in-page mode (since there's no close button in in-page mode)
    if (!showInPage) {
      trackEvent('dialog_closes', {
        dialog_type: 'signup',
        revealed_companies: filteredRecommendations.filter((rec) => rec.feedback).length,
        total_companies: recommendations.length,
      }).catch((error) => {
        console.error('Error tracking dialog close:', error);
      });
    }

    // Call the parent's onClose handler
    onClose();
  };

  // The content to be displayed both in dialog and in-page mode
  const content = (
    <>
      <div className="px-6 text-lg font-bold text-center text-white whitespace-pre-line md:text-2xl">
        {t('cta.title') || 'Ready to unlock your perfect career match?'}
      </div>

      {/* Company Cards */}
      <div className="relative flex items-center justify-center w-full overflow-hidden">
        <div className="w-full overflow-hidden">
          <BounceCards
            cards={companyCards}
            containerWidth={Math.min(
              600,
              Math.max(280, typeof window !== 'undefined' ? window.innerWidth * 0.6 - 48 : 280)
            )}
            containerHeight={Math.min(
              300,
              Math.max(200, typeof window !== 'undefined' ? window.innerWidth * 0.35 : 200)
            )}
            className="mx-auto"
            enableHover={true}
            transformStyles={
              isMobile
                ? [
                    'rotate(5deg) translate(-130px, -10px)',
                    'rotate(-10deg) translate(-80px, 10px)',
                    'rotate(0deg) translate(0px, -40px)',
                    'rotate(5deg) translate(60px, 30px)',
                    'rotate(-15deg) translate(140px, 10px)',
                  ]
                : [
                    'rotate(5deg) translate(-180px)',
                    'rotate(0deg) translate(-100px)',
                    'rotate(-5deg)',
                    'rotate(5deg) translate(100px)',
                    'rotate(-5deg) translate(180px)',
                  ]
            }
          />
        </div>
      </div>

      {/* Signup Buttons */}
      <div className="flex flex-col justify-center gap-4 px-6 sm:flex-row">
        <Button
          size="lg"
          onClick={handleSignupClick}
          disabled={isRedirecting}
          className={`w-full p-4 font-bold border border-white text-white transition-all rounded-md sm:w-auto bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 hover:scale-105 active:scale-95 ${
            isRedirecting ? 'opacity-60 cursor-not-allowed hover:scale-100' : ''
          }`}
        >
          {isRedirecting
            ? t('cta.primaryButtonRedirectMessage')
            : t('cta.primaryButton') || 'Sign up with Email'}
        </Button>

        {/* <GoogleSignUpButton t={t} onClick={handleGoogleSignupClick} /> */}
      </div>

      {/* Disclaimer */}
      <div className="px-6 mt-4 text-sm text-center text-white/60">
        <p>{t('cta.disclaimer') || 'By signing up, you agree to our Terms and Privacy Policy.'}</p>
      </div>
    </>
  );

  // If showing in-page, render directly without Dialog
  if (showInPage) {
    return (
      <div className="mt-12 mb-6 p-6 rounded-lg bg-gradient-to-b from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10 shadow-xl shadow-blue-500/10 max-w-[90vw] md:max-w-[85vw] mx-auto">
        {content}
      </div>
    );
  }

  // Otherwise render as modal dialog
  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="bg-gradient-to-b from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10 py-6 px-0 shadow-xl shadow-blue-500/10 max-w-[90vw] md:max-w-[55vw] max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">
          {t('cta.title') || 'Ready to unlock your perfect career match?'}
        </DialogTitle>

        {content}

        <DialogClose className="absolute p-2 transition-colors bg-white rounded-sm right-4 top-4 hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/40" />
      </DialogContent>
    </Dialog>
  );
};

export default SignupDialog;
