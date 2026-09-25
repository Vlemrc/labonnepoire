import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  type StyleProp,
  type ViewStyle,
} from "react-native";

const STEP_MS = 70;
const DURATION_MS = 320;
const RISE_PX = 14;

/**
 * Apparition en cascade.
 *
 * `index` decale le depart : les elements d'une liste entrent l'un apres
 * l'autre plutot que d'un bloc, ce qui donne au jeu son rythme de distribution
 * de cartes.
 *
 * On s'appuie sur l'API Animated du coeur de React Native, et NON sur les
 * animations d'entree de Reanimated : sur le web, ces dernieres ne se
 * declenchent pas de facon fiable pour un composant monte apres le premier
 * rendu — l'ecran reste vide alors que le contenu est bien dans le DOM.
 * Constate sur l'ecran de resultats, qui passe par un ecran de chargement
 * avant d'afficher ses cartes.
 *
 * Si le systeme demande la reduction des animations, il ne reste qu'un fondu :
 * supprimer le mouvement est precisement ce que reclame quelqu'un sujet au mal
 * des transports, et ce reglage existe pour etre respecte.
 */
export function Appear({
  children,
  index = 0,
  style,
}: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduced(value))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      delay: index * STEP_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, index]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [reduced ? 0 : RISE_PX, 0],
  });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
