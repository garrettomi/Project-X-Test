'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CompanyCard from '@/components/recommendations/CompanyCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RecommendationResult } from '@/lib/openai/client';
import { Company } from '@/lib/supabase/client';
import { useTranslation } from '@/i18n-client';
import SignupDialog from '@/components/recommendations/SignupDialog';
import AnimatedContent from '@/components/ui/Animations/AnimatedContent/AnimatedContent';
import { useIsMobile } from '@/hooks/useIsMobile';
import { trackRecommendationsPageVisit, trackCompanyInterestedClick } from '@/lib/analytics';
import { createUrlWithParams } from '@/lib/utils';

interface RecommendationsContentProps {
  lng: string;
}

export default function RecommendationsContent({ lng }: RecommendationsContentProps) {
  const searchParams = useSearchParams();
  const userId = searchParams?.get('userId') || '';
  const { t, loaded } = useTranslation(lng, 'ai');
  const isMobile = useIsMobile();
  const CARD_TO_SHOW_SIGNUP_DIALOG = 1;

  const [recommendations, setRecommendations] = useState<
    (RecommendationResult & {
      feedback?: 'interested' | 'not_interested';
    })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isSignupDialogOpen, setSignupDialogOpen] = useState(false);
  const [, setFeedbackCount] = useState(0);
  const [hasClosedDialog, setHasClosedDialog] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const [strengths, setStrengths] = useState<Array<string>>([]);
  const [values, setValues] = useState<Array<string>>([]);

  useEffect(() => {
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (!userId) {
      setError(t('recommendations.errors.missing_user_id'));
      setLoading(false);
      return;
    }

    const fetchUserDetails = async () => {
      const response = await fetch(`/api/values?userId=${userId}`);

      if (!response.ok) throw new Error('Error fetching user data from values');

      const data = await response.json();

      const extractedValues = Object.keys(data.user_values.values);
      const extractedStrengths = Object.keys(data.user_values.strengths);

      setValues(extractedValues);
      setStrengths(extractedStrengths);
    };

    const fetchRecommendations = async (refresh = false) => {
      // Set loading state if not refreshing
      if (!refresh) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      // Check if we should use streaming or not
      const useStreaming = true; // Can be made configurable if needed

      try {
        if (useStreaming) {
          // Use streaming API
          setIsStreaming(true);
          setRecommendations([]); // Clear existing recommendations

          // Set up fetch for streaming response
          const response = await fetch(
            `/api/recommendations/stream?userId=${userId}&locale=${lng}${
              refresh ? '&refresh=true' : ''
            }`
          );

          if (!response.ok) {
            throw new Error(t('recommendations.errors.fetch_failed'));
          }

          if (!response.body) {
            throw new Error('ReadableStream not supported');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          let done = false;
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;

            if (done) {
              // Streaming finished
              setIsStreaming(false);
              setLoading(false);
              setRefreshing(false);
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            // Split the chunk into lines (each line is a JSON object)
            const lines = chunk.split('\n').filter((line) => line.trim() !== '');

            console.log('Stream received:', { chunk, lineCount: lines.length });

            for (const line of lines) {
              try {
                console.log(
                  'Processing line:',
                  line.substring(0, 100) + (line.length > 100 ? '...' : '')
                );

                // Make sure the line is valid JSON
                if (!line.trim().startsWith('{') || !line.trim().endsWith('}')) {
                  console.warn("Line doesn't appear to be valid JSON:", line);
                  continue;
                }

                const data = JSON.parse(line);
                console.log('Parsed data:', data);

                if (data.recommendation) {
                  console.log(
                    'Found recommendation for:',
                    data.recommendation.company?.name || 'Unknown company'
                  );
                  console.log('Recommendation details:', {
                    id: data.recommendation.id,
                    companyId: data.recommendation.company?.id,
                    matchingPoints: data.recommendation.matching_points?.length || 0,
                  });

                  // Add the new recommendation to the state
                  setRecommendations((prev) => {
                    // Check if we already have this recommendation
                    const exists = prev.some((r) => r.id === data.recommendation.id);
                    if (exists) {
                      console.log('Recommendation already exists, skipping');
                      return prev;
                    }

                    console.log('Adding new recommendation to state');
                    return [...prev, data.recommendation];
                  });
                } else {
                  console.warn('Parsed JSON does not contain a recommendation property:', data);
                }
              } catch (e) {
                console.error('Error parsing JSON from stream:', e, 'Line:', line);
              }
            }
          }
        } else {
          // Use regular API
          const response = await fetch(
            `/api/recommendations?userId=${userId}&locale=${lng}${refresh ? '&refresh=true' : ''}`
          );

          if (!response.ok) {
            throw new Error(t('recommendations.errors.fetch_failed'));
          }

          const data = await response.json();
          setRecommendations(data.recommendations);
          setLoading(false);
          setRefreshing(false);
        }
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError(t('recommendations.errors.general'));
        setLoading(false);
        setRefreshing(false);
        setIsStreaming(false);
      }
    };

    const initialPromises = [
      // Track recommendations page visit
      trackRecommendationsPageVisit(),
      // Fetch strengths & values for users to reference when reviewing results
      fetchUserDetails(),
    ];

    Promise.all(initialPromises).catch((error) => {
      console.error(
        'Error during initial fetch for tracking page visits and fetching user details:',
        error
      );
    });

    if (loaded) {
      fetchRecommendations();
    }
  }, [userId, t, loaded, lng]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const fetchRecommendations = async () => {
      if (!userId) {
        setError(t('recommendations.errors.missing_user_id'));
        setRefreshing(false);
        return;
      }

      try {
        // Always use streaming for refresh
        setIsStreaming(true);
        setRecommendations([]); // Clear existing recommendations

        // Set up fetch for streaming response
        const response = await fetch(
          `/api/recommendations/stream?userId=${userId}&locale=${lng}&refresh=true`
        );

        if (!response.ok) {
          throw new Error(t('recommendations.errors.fetch_failed'));
        }

        if (!response.body) {
          throw new Error('ReadableStream not supported');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (done) {
            // Streaming finished
            setIsStreaming(false);
            setRefreshing(false);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          // Split the chunk into lines (each line is a JSON object)
          const lines = chunk.split('\n').filter((line) => line.trim() !== '');

          console.log('Stream received:', { chunk, lineCount: lines.length });

          for (const line of lines) {
            try {
              console.log(
                'Processing line:',
                line.substring(0, 100) + (line.length > 100 ? '...' : '')
              );

              // Make sure the line is valid JSON
              if (!line.trim().startsWith('{') || !line.trim().endsWith('}')) {
                console.warn("Line doesn't appear to be valid JSON:", line);
                continue;
              }

              const data = JSON.parse(line);
              console.log('Parsed data:', data);

              if (data.recommendation) {
                console.log(
                  'Found recommendation for:',
                  data.recommendation.company?.name || 'Unknown company'
                );
                console.log('Recommendation details:', {
                  id: data.recommendation.id,
                  companyId: data.recommendation.company?.id,
                  matchingPoints: data.recommendation.matching_points?.length || 0,
                });

                // Add the new recommendation to the state
                setRecommendations((prev) => {
                  // Check if we already have this recommendation
                  const exists = prev.some((r) => r.id === data.recommendation.id);
                  if (exists) {
                    console.log('Recommendation already exists, skipping');
                    return prev;
                  }

                  console.log('Adding new recommendation to state');
                  return [...prev, data.recommendation];
                });
              } else {
                console.warn('Parsed JSON does not contain a recommendation property:', data);
              }
            } catch (e) {
              console.error('Error parsing JSON from stream:', e, 'Line:', line);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError(t('recommendations.errors.general'));
        setRefreshing(false);
        setIsStreaming(false);
      }
    };

    fetchRecommendations();
  };

  const handleFeedback = async (
    recommendationId: string,
    feedback: 'interested' | 'not_interested',
    company: Company
  ) => {
    try {
      // Only track interested clicks
      if (feedback === 'interested') {
        await trackCompanyInterestedClick(company.id, company.name);
      }

      const response = await fetch('/api/recommendations/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recommendationId,
          feedback,
        }),
      });

      if (!response.ok) {
        throw new Error(t('recommendations.errors.feedback_failed'));
      }

      // Update local state
      setRecommendations((prev) =>
        prev.map((rec) => (rec.id === recommendationId ? { ...rec, feedback } : rec))
      );

      // Increment feedback count
      setFeedbackCount((prevCount) => {
        const newCount = prevCount + 1;

        // If this is the last recommendation, wait for the reveal animation
        // before showing the signup dialog
        if (newCount === CARD_TO_SHOW_SIGNUP_DIALOG) {
          // Wait for the reveal animation (2000ms) plus a small buffer
          setTimeout(() => {
            setSignupDialogOpen(true);
          }, 3000);
        }

        return newCount;
      });
    } catch (err) {
      console.error('Error submitting feedback:', err);
      // Show error message to user
    }
  };

  // Handle dialog close to track when user has dismissed the dialog
  const handleDialogClose = () => {
    setSignupDialogOpen(false);
    setHasClosedDialog(true);
  };

  // Show loading state while translations are loading
  if (!loaded) {
    return (
      <div className="container px-4 py-8 mx-auto">
        <div className="max-w-4xl mx-auto text-center">
          <Skeleton className="w-1/3 h-8 mx-auto mb-4" />
          <Skeleton className="w-1/2 h-4 mx-auto mb-8" />
        </div>
      </div>
    );
  }

  if (loading && recommendations.length === 0) {
    return (
      <div className="container px-4 py-8 mx-auto">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="mb-8 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
            {t('recommendations.loading.title')}
          </h1>
          <p className="mb-8 text-lg text-gray-300">{t('recommendations.loading.description')}</p>
          <div className="max-w-4xl mx-auto">
            <AnimatedContent direction="vertical" distance={20} delay={500}>
              <Skeleton className="h-[200px] w-full mb-4 bg-white/10 border border-white/10 backdrop-blur-sm" />
            </AnimatedContent>
            <AnimatedContent direction="vertical" distance={20} delay={2000}>
              <Skeleton className="h-[200px] w-full mb-4 bg-white/10 border border-white/10 backdrop-blur-sm" />
            </AnimatedContent>
            <AnimatedContent direction="vertical" distance={20} delay={3000}>
              <Skeleton className="h-[200px] w-full mb-4 bg-white/10 border border-white/10 backdrop-blur-sm" />
            </AnimatedContent>
            <AnimatedContent direction="vertical" distance={20} delay={4000}>
              <Skeleton className="h-[200px] w-full bg-white/10 border border-white/10 backdrop-blur-sm" />
            </AnimatedContent>
          </div>
        </div>
      </div>
    );
  }

  if (error && recommendations.length === 0) {
    return (
      <div className="container px-4 py-8 mx-auto">
        <div className="max-w-4xl mx-auto">
          <Card className="max-w-md mx-auto bg-gradient-to-b from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10">
            <CardHeader>
              <CardTitle className="text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
                {t('recommendations.errors.title')}
              </CardTitle>
              <CardDescription className="text-center text-gray-300">{error}</CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-center">
              <Button
                onClick={() => {
                  // Create URL with preserved query parameters
                  const currentParams = new URLSearchParams(window.location.search);
                  const url = createUrlWithParams(`/${lng}/questionnaire`, currentParams);
                  window.location.href = url;
                }}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                {t('recommendations.errors.try_again')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container px-4 py-4 mx-auto sm:py-8">
      <div className="max-w-4xl mx-auto">
        <AnimatedContent direction="vertical" distance={40} delay={300}>
          <h1 className="mb-4 text-2xl font-bold text-center text-transparent sm:text-3xl md:text-4xl sm:mb-8 bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
            {t('recommendations.title')}
          </h1>
        </AnimatedContent>

        <AnimatedContent direction="vertical" distance={30} delay={450}>
          <ul className="text-start text-gray-300 mb-2">
            <div className="my-2">
              <span className="text-sm sm:text-base">{t('recommendations.userValues')}</span>
            </div>
            {values &&
              values.map((value: string, index: number) => (
                <li
                  key={index}
                  className="font-medium sm:font-bold text-xs sm:text-sm leading-relaxed sm:leading-loose list-disc list-inside"
                >
                  {value}
                </li>
              ))}
          </ul>
          <ul className="mb-4 text-start text-gray-300 sm:mb-8">
            <div className="my-2">
              <span className="text-sm sm:text-base">{t('recommendations.userStrengths')}</span>
            </div>
            {strengths &&
              strengths.map((strength: string, index: number) => (
                <li
                  key={index}
                  className="font-medium sm:font-bold text-xs sm:text-sm leading-relaxed sm:leading-loose list-disc list-inside"
                >
                  {strength}
                </li>
              ))}
          </ul>
          <p className="mb-4 text-base text-center text-gray-300 sm:text-lg sm:mb-8">
            {t('recommendations.description')}
          </p>
        </AnimatedContent>

        {/* Display filtered recommendations */}
        <div className="mt-3 space-y-4 sm:mt-6 sm:space-y-6">
          {isStreaming && recommendations.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-gray-300">{t('recommendations.loading.streaming')}</p>
              <div className="flex justify-center mt-4">
                <div className="w-6 h-6 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
              </div>
            </div>
          ) : recommendations.length > 0 ? (
            recommendations.map((recommendation, index) => (
              <AnimatedContent
                key={recommendation.id || recommendation.company.id}
                direction="vertical"
                distance={20}
                delay={isMobile ? (index === 0 ? 900 : 100) : index === 0 ? 900 : 400}
              >
                <CompanyCard
                  key={recommendation.id || recommendation.company.id}
                  company={recommendation.company}
                  matchingPoints={recommendation.matching_points}
                  valueMatchingRatings={recommendation.value_match_ratings}
                  strengthMatchingRatings={recommendation.strength_match_ratings}
                  feedback={recommendation.feedback}
                  onFeedback={(feedbackType) =>
                    recommendation.id &&
                    handleFeedback(recommendation.id, feedbackType, recommendation.company)
                  }
                  lng={lng}
                />
              </AnimatedContent>
            ))
          ) : (
            <div className="py-8 text-center">
              <p className="text-gray-300">{t('recommendations.no_matches')}</p>
            </div>
          )}

          {/* Display streaming indicator at the end if still streaming */}
          {isStreaming && recommendations.length > 0 && (
            <div className="flex items-center justify-center py-4 mt-4 text-gray-300">
              <div className="w-5 h-5 mr-3 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
              <span>{t('recommendations.loading.more_coming')}</span>
            </div>
          )}

          {/* Show partial success message if we got fewer recommendations than expected */}
          {!isStreaming && recommendations.length > 0 && recommendations.length < 5 && (
            <div className="flex flex-col items-center justify-center py-4 mt-4 text-gray-300">
              <p className="mb-2">
                {t('recommendations.partial_success', {
                  count: recommendations.length,
                })}
              </p>
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="bg-gradient-to-b from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10 hover:shadow-blue-500/10"
              >
                {t('recommendations.get_more')}
              </Button>
            </div>
          )}
        </div>

        <AnimatedContent direction="vertical" distance={20} delay={100}>
          <div className="flex justify-end my-6">
            <Button
              onClick={handleRefresh}
              disabled={refreshing || isStreaming}
              variant="outline"
              className="w-full flex items-center gap-2 text-sm sm:text-base bg-gradient-to-b from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10 hover:shadow-blue-500/10"
            >
              {refreshing || isStreaming ? (
                <>
                  <svg
                    className="w-4 h-4 mr-2 -ml-1 animate-spin text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {t('recommendations.refreshing')}
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {t('recommendations.refresh')}
                </>
              )}
            </Button>
          </div>
        </AnimatedContent>

        <SignupDialog
          open={isSignupDialogOpen}
          onClose={handleDialogClose}
          lng={lng}
          recommendations={recommendations}
        />

        {/* Show SignupDialog as in-page component after user has closed the modal */}
        {recommendations.length > 0 && (
          <SignupDialog
            open={false}
            onClose={() => {}}
            lng={lng}
            recommendations={recommendations}
            showInPage={true}
          />
        )}
      </div>
    </div>
  );
}
